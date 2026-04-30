const express = require("express");
const router = express.Router();
const tenantController = require("../controllers/tenantController");

const authAkun = require("../middleware/authAkun");
const authPengguna = require("../middleware/authPengguna");
const { adminOnly } = require("../middleware/authorize");
const { checkPermission } = require("../middleware/authorizePermission");

const wrap = (fn) => (req, res, next) => {
  Promise.resolve(fn.call(tenantController, req, res, next)).catch(next);
};

// daftar semua tenant (khusus super admin SaaS)
router.get("/", adminOnly, wrap(tenantController.getAll));

// registrasi tenant baru (khusus akun owner)
router.post("/", authAkun, wrap(tenantController.create));

// lihat detail tenant (karyawan dengan izin read-tenant)
router.get("/:id", authPengguna, wrap(tenantController.getById));

// perbarui data tenant
router.put("/:id", authPengguna, checkPermission("update-tenant"), wrap(tenantController.update));

// hapus tenant permanen
router.delete("/:id", authPengguna, checkPermission("delete-tenant"), wrap(tenantController.delete));

module.exports = router;