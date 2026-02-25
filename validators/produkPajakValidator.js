const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function validateProdukPajakPayload(data) {
  const errors = [];

  // Validasi XOR: Wajib isi salah satu antara produkID atau assetID
  const hasProduk = data.produkID && isValidObjectId(data.produkID);
  const hasAsset = data.assetID && isValidObjectId(data.assetID);

  if (!hasProduk && !hasAsset) {
    errors.push(
      "Wajib mengisi salah satu antara produkID atau assetID yang valid",
    );
  }

  // Validasi PajakID
  if (!data.pajakID || !isValidObjectId(data.pajakID)) {
    errors.push("pajakID wajib diisi dan valid");
  }

  // // Validasi Nama Pajak (Sesuai skema gambar)
  // if (!data.nama_pajak || typeof data.nama_pajak !== "string") {
  //   errors.push("nama_pajak wajib diisi");
  // }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validateProdukPajakPayload };
