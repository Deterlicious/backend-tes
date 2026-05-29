const express = require("express");
const router = express.Router();
const produkController = require("../controllers/produkController");
const authPengguna = require("../middleware/authPengguna");
const { checkPermission } = require("../middleware/authorizePermission");

// Helper untuk menangani async error (Konsisten dengan modul Location)
const wrap = (fn) => (req, res, next) => {
  if (!fn)
    return next(
      new Error("Controller function not found. Check your exports/imports."),
    );
  return Promise.resolve(fn(req, res, next)).catch(next);
};

// Semua rute produk wajib login
router.use(authPengguna);

// Definisi Rute (Eksplisit & Seragam dengan style Location)
router.get("/", checkPermission("read-produk", "akses-pos"), wrap(produkController.getAll));
router.get("/:id", checkPermission("read-produk", "akses-pos"), wrap(produkController.getById));
router.post("/", checkPermission("create-produk"), wrap(produkController.create));
router.put("/:id", checkPermission("update-produk"), wrap(produkController.update));
router.delete("/:id", checkPermission("delete-produk"), wrap(produkController.delete));

module.exports = router;
