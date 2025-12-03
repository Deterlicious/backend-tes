const mongoose = require("mongoose");

function validateAssignPermission(data) {
  const errors = [];

  if (!data.tenantID || !mongoose.Types.ObjectId.isValid(data.tenantID)) {
    errors.push("tenantID wajib diisi dan valid");
  }
  if (!data.roleID || !mongoose.Types.ObjectId.isValid(data.roleID)) {
    errors.push("roleID wajib diisi dan valid");
  }
  if (!data.permissionID || !mongoose.Types.ObjectId.isValid(data.permissionID)) {
    errors.push("permissionID wajib diisi dan valid");
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true };
}

module.exports = { validateAssignPermission };