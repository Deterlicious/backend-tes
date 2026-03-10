const mongoose = require("mongoose");

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

function validateProdukPajakPayload(data) {
  const errors = [];

  const hasProduk = data.produkID && isValidObjectId(data.produkID);
  const hasAsset = data.assetID && isValidObjectId(data.assetID);

  if (!hasProduk && !hasAsset) {
    errors.push(
      "Wajib mengisi salah satu antara produkID atau assetID yang valid"
    );
  }

  if (hasProduk && hasAsset) {
    errors.push("Hanya boleh mengisi salah satu antara produkID atau assetID");
  }

  if (!data.pajakID || !isValidObjectId(data.pajakID)) {
    errors.push("pajakID wajib diisi dan valid");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}

module.exports = { validateProdukPajakPayload };