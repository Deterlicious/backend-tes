const { validateTenantPayload } = require("../../../validators/tenantValidator");

describe("Unit Test Tenant Validator", () => {
  describe("Mode Create (isUpdate = false)", () => {
    test("harus valid jika namaToko minimal 3 karakter", () => {
      const payload = { namaToko: "Toko Sukses", status: "aktif" };
      const result = validateTenantPayload(payload);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test("harus gagal jika namaToko tidak dikirim", () => {
      const payload = { status: "aktif" };
      const result = validateTenantPayload(payload);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("namaToko wajib diisi");
    });

    test("harus gagal jika namaToko berupa string kosong", () => {
      const payload = { namaToko: "" };
      const result = validateTenantPayload(payload);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("namaToko wajib diisi");
    });

    test("harus gagal jika namaToko kurang dari 3 karakter", () => {
      const payload = { namaToko: "Ab" };
      const result = validateTenantPayload(payload);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("namaToko minimal 3 karakter");
    });
  });

  describe("Mode Update (isUpdate = true)", () => {
    test("harus valid meskipun tidak mengirim namaToko (partial update)", () => {
      const payload = { status: "non-aktif" };
      const result = validateTenantPayload(payload, true);
      
      expect(result.valid).toBe(true);
    });

    test("harus gagal jika mengirim namaToko tetapi kurang dari 3 karakter", () => {
      const payload = { namaToko: "X" };
      const result = validateTenantPayload(payload, true);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("namaToko minimal 3 karakter");
    });
  });

  describe("Validasi Status dan Multi-Error", () => {
    test("harus gagal jika status tidak dikenali", () => {
      const payload = { namaToko: "Toko B", status: "banned" };
      const result = validateTenantPayload(payload);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("status hanya boleh 'aktif' atau 'non-aktif'");
    });

    test("harus menumpuk banyak error jika beberapa field salah sekaligus", () => {
      const payload = { namaToko: "A", status: "salah" };
      const result = validateTenantPayload(payload);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors).toContain("namaToko minimal 3 karakter");
      expect(result.errors).toContain("status hanya boleh 'aktif' atau 'non-aktif'");
    });
  });
});