export interface PermissionTriplet {
  read: boolean;
  write: boolean;
  execute: boolean;
}

export interface SpecialPermissions {
  setuid: boolean;
  setgid: boolean;
  sticky: boolean;
}

export interface ChmodState {
  owner: PermissionTriplet;
  group: PermissionTriplet;
  others: PermissionTriplet;
  special: SpecialPermissions;
  fileType: "file" | "directory" | "symlink";
}

export const DEFAULT_CHMOD_STATE: ChmodState = {
  owner: { read: true, write: true, execute: true },
  group: { read: true, write: false, execute: true },
  others: { read: true, write: false, execute: true },
  special: { setuid: false, setgid: false, sticky: false },
  fileType: "file",
};

export function tripletToOctal(triplet: PermissionTriplet): number {
  return (triplet.read ? 4 : 0) + (triplet.write ? 2 : 0) + (triplet.execute ? 1 : 0);
}

export function specialToOctal(special: SpecialPermissions): number {
  return (special.setuid ? 4 : 0) + (special.setgid ? 2 : 0) + (special.sticky ? 1 : 0);
}

export function getOctalString(state: ChmodState, includeSpecialIfZero = false): string {
  const s = specialToOctal(state.special);
  const u = tripletToOctal(state.owner);
  const g = tripletToOctal(state.group);
  const o = tripletToOctal(state.others);

  if (s > 0 || includeSpecialIfZero) {
    return `${s}${u}${g}${o}`;
  }
  return `${u}${g}${o}`;
}

export function getSymbolicString(state: ChmodState): string {
  let typeChar = "-";
  if (state.fileType === "directory") typeChar = "d";
  if (state.fileType === "symlink") typeChar = "l";

  // Owner
  const uR = state.owner.read ? "r" : "-";
  const uW = state.owner.write ? "w" : "-";
  let uX = state.owner.execute ? "x" : "-";
  if (state.special.setuid) {
    uX = state.owner.execute ? "s" : "S";
  }

  // Group
  const gR = state.group.read ? "r" : "-";
  const gW = state.group.write ? "w" : "-";
  let gX = state.group.execute ? "x" : "-";
  if (state.special.setgid) {
    gX = state.group.execute ? "s" : "S";
  }

  // Others
  const oR = state.others.read ? "r" : "-";
  const oW = state.others.write ? "w" : "-";
  let oX = state.others.execute ? "x" : "-";
  if (state.special.sticky) {
    oX = state.others.execute ? "t" : "T";
  }

  return `${typeChar}${uR}${uW}${uX}${gR}${gW}${gX}${oR}${oW}${oX}`;
}

export function parseOctalToState(octalStr: string, currentState: ChmodState): ChmodState {
  const clean = octalStr.trim().replace(/^0+/, "");
  const num = clean === "" ? "0" : clean;
  if (!/^[0-7]{1,4}$/.test(num)) {
    throw new Error("Octal permission must be 1 to 4 digits between 0 and 7 (e.g. 755 or 0755)");
  }

  const padded = num.padStart(4, "0");
  const sDigit = parseInt(padded[0], 10);
  const uDigit = parseInt(padded[1], 10);
  const gDigit = parseInt(padded[2], 10);
  const oDigit = parseInt(padded[3], 10);

  const digitToTriplet = (d: number): PermissionTriplet => ({
    read: (d & 4) !== 0,
    write: (d & 2) !== 0,
    execute: (d & 1) !== 0,
  });

  return {
    ...currentState,
    special: {
      setuid: (sDigit & 4) !== 0,
      setgid: (sDigit & 2) !== 0,
      sticky: (sDigit & 1) !== 0,
    },
    owner: digitToTriplet(uDigit),
    group: digitToTriplet(gDigit),
    others: digitToTriplet(oDigit),
  };
}

export function parseSymbolicToState(symStr: string, currentState: ChmodState): ChmodState {
  const trimmed = symStr.trim();
  let text = trimmed;
  let fileType: ChmodState["fileType"] = currentState.fileType;

  if (text.length === 10) {
    const first = text[0];
    if (first === "d") fileType = "directory";
    else if (first === "l") fileType = "symlink";
    else fileType = "file";
    text = text.slice(1);
  }

  if (text.length !== 9) {
    throw new Error("Symbolic string must be 9 characters (e.g. rwxr-xr-x) or 10 characters (e.g. -rwxr-xr-x)");
  }

  const parseOwnerX = (c: string) => ({ exec: c === "x" || c === "s", suid: c === "s" || c === "S" });
  const parseGroupX = (c: string) => ({ exec: c === "x" || c === "s", sgid: c === "s" || c === "S" });
  const parseOtherX = (c: string) => ({ exec: c === "x" || c === "t", sticky: c === "t" || c === "T" });

  const uXInfo = parseOwnerX(text[2]);
  const gXInfo = parseGroupX(text[5]);
  const oXInfo = parseOtherX(text[8]);

  return {
    fileType,
    owner: {
      read: text[0] === "r",
      write: text[1] === "w",
      execute: uXInfo.exec,
    },
    group: {
      read: text[3] === "r",
      write: text[4] === "w",
      execute: gXInfo.exec,
    },
    others: {
      read: text[6] === "r",
      write: text[7] === "w",
      execute: oXInfo.exec,
    },
    special: {
      setuid: uXInfo.suid,
      setgid: gXInfo.sgid,
      sticky: oXInfo.sticky,
    },
  };
}

export function getChmodCommands(state: ChmodState, targetName = "file.txt"): {
  numeric: string;
  symbolic: string;
  recursive: string;
} {
  const octal = getOctalString(state);

  const tripletToSym = (t: PermissionTriplet): string => {
    const parts = [];
    if (t.read) parts.push("r");
    if (t.write) parts.push("w");
    if (t.execute) parts.push("x");
    return parts.join("") || "-";
  };

  const u = tripletToSym(state.owner);
  const g = tripletToSym(state.group);
  const o = tripletToSym(state.others);

  const symCmd = `chmod u=${u},g=${g},o=${o} ${targetName}`;
  const numCmd = `chmod ${octal} ${targetName}`;
  const recCmd = `chmod -R ${octal} ${state.fileType === "directory" ? targetName : "./folder"}`;

  return {
    numeric: numCmd,
    symbolic: symCmd,
    recursive: recCmd,
  };
}

export function describePermissions(state: ChmodState): {
  owner: string[];
  group: string[];
  others: string[];
  special: string[];
} {
  const formatTriplet = (t: PermissionTriplet) => {
    const perms: string[] = [];
    if (t.read) perms.push("Read (r)");
    if (t.write) perms.push("Write (w)");
    if (t.execute) perms.push("Execute (x)");
    return perms.length > 0 ? perms : ["No Access (---)"];
  };

  const specials: string[] = [];
  if (state.special.setuid) specials.push("SetUID (Execute as owner)");
  if (state.special.setgid) specials.push("SetGID (Execute as group)");
  if (state.special.sticky) specials.push("Sticky bit (Only owner/root can delete files in folder)");

  return {
    owner: formatTriplet(state.owner),
    group: formatTriplet(state.group),
    others: formatTriplet(state.others),
    special: specials,
  };
}

export const CHMOD_PRESETS = [
  { name: "777 - Full Access", octal: "777", desc: "Read, write & execute for everyone" },
  { name: "755 - Standard Executable / Dir", octal: "755", desc: "Owner full, group & others read/execute" },
  { name: "700 - Private Directory", octal: "700", desc: "Owner full access, others none" },
  { name: "644 - Standard File", octal: "644", desc: "Owner read/write, group & others read-only" },
  { name: "600 - Private Key / Secret", octal: "600", desc: "Owner read/write, others none" },
  { name: "400 - Read-only SSH Key", octal: "400", desc: "Owner read-only (id_rsa requirement)" },
  { name: "1777 - Sticky Temp Dir (/tmp)", octal: "1777", desc: "Full access with sticky bit protection" },
];
