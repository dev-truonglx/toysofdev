import { describe, it, expect } from "vitest";
import {
  isValidLuhn,
  generateValidCreditCard,
  generateVietnamCccd,
  generateVietnamTaxCode,
  generateJapaneseMyNumber,
  isValidJapaneseMyNumber,
  generateMockDataset,
  exportMockToJson,
  exportMockToCsv,
  exportMockToSql,
  DEFAULT_MOCK_FIELDS,
} from "../fakeDataEngine";

describe("fakeDataEngine", () => {
  describe("Luhn Checksum & Credit Card Generator", () => {
    it("validates known credit cards against Luhn Modulo 10", () => {
      // Standard Luhn test vector
      expect(isValidLuhn("79927398713")).toBe(true);
      expect(isValidLuhn("79927398710")).toBe(false);
    });

    it("generates valid Visa, Mastercard, JCB, and Amex cards conforming to Luhn algorithm", () => {
      const types: ("Visa" | "Mastercard" | "JCB" | "Amex")[] = ["Visa", "Mastercard", "JCB", "Amex"];
      for (const t of types) {
        const card = generateValidCreditCard(t);
        expect(card.type).toBe(t);
        const rawDigits = card.number.replace(/\s+/g, "");
        expect(isValidLuhn(rawDigits)).toBe(true);
        if (t === "Visa") expect(rawDigits.startsWith("4")).toBe(true);
        if (t === "JCB") expect(rawDigits.startsWith("35")).toBe(true);
        if (t === "Amex") expect(rawDigits.startsWith("34") || rawDigits.startsWith("37")).toBe(true);
      }
    });
  });

  describe("Vietnam CCCD and Tax Code", () => {
    it("generates a 12-digit Vietnam CCCD with valid century/gender code", () => {
      const male1995 = generateVietnamCccd(1995, false);
      expect(male1995.length).toBe(12);
      expect(male1995.charAt(3)).toBe("0"); // 20th century male
      expect(male1995.substring(4, 6)).toBe("95");

      const female2002 = generateVietnamCccd(2002, true);
      expect(female2002.length).toBe(12);
      expect(female2002.charAt(3)).toBe("3"); // 21st century female
      expect(female2002.substring(4, 6)).toBe("02");
    });

    it("generates a 10-digit Vietnamese Tax Code with valid Modulo-11 checksum", () => {
      for (let i = 0; i < 10; i++) {
        const taxCode = generateVietnamTaxCode();
        expect(taxCode.length).toBe(10);
        // Verify modulo 11
        const digits = taxCode.split("").map(Number);
        const weights = [10, 9, 8, 7, 6, 5, 4, 3, 2];
        const sum = digits.slice(0, 9).reduce((acc, d, idx) => acc + d * weights[idx], 0);
        const remainder = sum % 11;
        let expectedCheck = 11 - remainder;
        if (expectedCheck === 10 || expectedCheck === 11) expectedCheck = 0;
        expect(digits[9]).toBe(expectedCheck);
      }
    });
  });

  describe("Japanese My Number (マイナンバー) and Datasets", () => {
    it("generates and validates authentic 12-digit Japanese My Number with official Modulo 11 checksum", () => {
      for (let i = 0; i < 10; i++) {
        const myNumber = generateJapaneseMyNumber();
        expect(myNumber.length).toBe(12);
        expect(isValidJapaneseMyNumber(myNumber)).toBe(true);
      }

      // Invalid checksum should fail
      expect(isValidJapaneseMyNumber("123456789010")).toBe(false);
    });

    it("generates authentic Japanese records with Kanji, postal codes, and 090/080 phone numbers", () => {
      const records = generateMockDataset({
        count: 5,
        locale: "ja",
        minAge: 22,
        maxAge: 45,
        gender: "all",
        fields: {
          fullName: true,
          gender: true,
          phone: true,
          citizenId: true,
          address: true,
          bankAccount: true,
        },
      });

      expect(records.length).toBe(5);
      expect(records[0].fullName).toBeDefined();
      expect(records[0].phone).toMatch(/^0[789]0-\d{4}-\d{4}$/); // Japan mobile pattern
      expect(records[0].citizenId).toHaveLength(12);
      expect(isValidJapaneseMyNumber(records[0].citizenId!)).toBe(true);
      expect(records[0].address).toContain("〒");
      expect(typeof records[0].bankAccount).toBe("object");
      expect((records[0].bankAccount as { balance: string }).balance).toContain("¥");
    });
  });

  describe("Dataset Generation & Export", () => {
    const defaultFieldsMap = DEFAULT_MOCK_FIELDS.reduce((acc, f) => {
      acc[f.id] = f.enabled;
      return acc;
    }, {} as Record<string, boolean>);

    it("generates realistic Vietnamese records", () => {
      const records = generateMockDataset({
        count: 5,
        locale: "vi",
        minAge: 20,
        maxAge: 40,
        gender: "all",
        fields: defaultFieldsMap,
      });

      expect(records.length).toBe(5);
      expect(records[0].fullName).toBeDefined();
      expect(records[0].phone).toMatch(/^0[3|5|7|8|9]/); // VN prefix
      expect(records[0].citizenId).toHaveLength(12);
      expect(records[0].age).toBeGreaterThanOrEqual(20);
      expect(records[0].age).toBeLessThanOrEqual(40);
    });

    it("generates realistic English records", () => {
      const records = generateMockDataset({
        count: 5,
        locale: "en",
        minAge: 18,
        maxAge: 65,
        gender: "all",
        fields: defaultFieldsMap,
      });

      expect(records.length).toBe(5);
      expect(records[0].phone).toContain("+1");
      expect(records[0].email).toContain("@");
      expect(records.every((r) => r.email?.endsWith("@example.com"))).toBe(true);
    });

    it("ensures all generated emails strictly use RFC 2606 reserved @example.com domain", () => {
      const locales: ("vi" | "en" | "ja")[] = ["vi", "en", "ja"];
      for (const loc of locales) {
        const dataset = generateMockDataset({
          count: 10,
          locale: loc,
          minAge: 18,
          maxAge: 60,
          gender: "all",
          fields: { email: true },
        });
        for (const item of dataset) {
          expect(item.email).toBeDefined();
          expect(item.email?.endsWith("@example.com")).toBe(true);
        }
      }
    });

    it("exports records to JSON, CSV, and SQL INSERT", () => {
      const records = generateMockDataset({
        count: 3,
        locale: "vi",
        minAge: 25,
        maxAge: 35,
        gender: "all",
        fields: { fullName: true, phone: true, email: true },
      });

      // JSON
      const json = exportMockToJson(records);
      const parsed = JSON.parse(json);
      expect(parsed.length).toBe(3);
      expect(parsed[0].fullName).toBe(records[0].fullName);

      // CSV
      const csv = exportMockToCsv(records);
      expect(csv).toContain("id,fullName,phone,email");

      // SQL
      const sql = exportMockToSql(records, "users");
      expect(sql).toContain("INSERT INTO users");
      expect(sql.split("\n").length).toBe(3);
    });

    it("supports dynamic custom fields with options, number-range, pattern, regex, and boolean", () => {
      const records = generateMockDataset({
        count: 10,
        locale: "vi",
        minAge: 20,
        maxAge: 30,
        gender: "all",
        customFields: [
          {
            id: "status",
            name: "orderStatus",
            dataType: "options-list",
            optionsList: ["PENDING", "PROCESSING", "COMPLETED", "CANCELLED"],
            enabled: true,
            isCustom: true,
          },
          {
            id: "score",
            name: "creditScore",
            dataType: "number-range",
            numberMin: 300,
            numberMax: 850,
            numberDecimals: 0,
            enabled: true,
            isCustom: true,
          },
          {
            id: "sku",
            name: "itemSku",
            dataType: "text-pattern",
            textPattern: "SKU-####-??",
            enabled: true,
            isCustom: true,
          },
          {
            id: "active",
            name: "isActive",
            dataType: "boolean",
            booleanFormat: "1/0",
            enabled: true,
            isCustom: true,
          },
          {
            id: "tracking",
            name: "trackingCode",
            dataType: "custom-regex",
            customRegex: "^VN\\d{8}[A-Z]{2}$",
            enabled: true,
            isCustom: true,
          },
          {
            id: "created",
            name: "createdAt",
            dataType: "date-range",
            dateFrom: "2025-01-01",
            dateTo: "2025-12-31",
            enabled: true,
            isCustom: true,
          },
          {
            id: "disabledField",
            name: "shouldNotAppear",
            dataType: "options-list",
            optionsList: ["NONE"],
            enabled: false,
            isCustom: true,
          },
        ],
      });

      expect(records.length).toBe(10);
      for (const rec of records) {
        // Options list check
        expect(["PENDING", "PROCESSING", "COMPLETED", "CANCELLED"]).toContain(rec.orderStatus);

        // Number range check
        expect(typeof rec.creditScore).toBe("number");
        expect(Number(rec.creditScore)).toBeGreaterThanOrEqual(300);
        expect(Number(rec.creditScore)).toBeLessThanOrEqual(850);

        // Text pattern check
        expect(rec.itemSku).toMatch(/^SKU-\d{4}-[A-Z]{2}$/);

        // Boolean 1/0 check
        expect([0, 1]).toContain(rec.isActive);

        // Custom regex check
        expect(rec.trackingCode).toMatch(/^VN\d{8}[A-Z]{2}$/);

        // Date range check
        expect(rec.createdAt).toMatch(/^2025-\d{2}-\d{2}$/);

        // Disabled field check
        expect(rec.shouldNotAppear).toBeUndefined();
      }

      // Check CSV export includes all active custom fields
      const csv = exportMockToCsv(records);
      expect(csv).toContain("id,orderStatus,creditScore,itemSku,isActive,trackingCode,createdAt");
      expect(csv).not.toContain("shouldNotAppear");

      // Check SQL export includes sanitized column names
      const sql = exportMockToSql(records, "custom_orders");
      expect(sql).toContain("INSERT INTO custom_orders (order_status, credit_score, item_sku, is_active, tracking_code, created_at)");
    });
  });
});
