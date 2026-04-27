// const Akun = require("../models/akunModel");
// const redis = require("../config/redis");
// const { validateDeviceAction } = require("../validators/akunValidator");
// const createError = require("http-errors");

// const KEY_PROFILE = (id) => `akun:profile:${id}`;

// class DeviceService {

//   async addDevice(userId, payload) {
//     const validation = validateDeviceAction(payload);
//     if (!validation.valid) return { error: validation.errors };

//     const { deviceID, type } = payload;
//     const user = await Akun.findById(userId);
//     if (!user) throw createError(404, "User not found");

//     // Cek Duplikasi
//     if (user.device.some(d => d.deviceID === deviceID)) {
//       return { error: ["DeviceID sudah terdaftar"] };
//     }

//     // Cek Quota
//     if (user.device.length >= user.maxDevice) {
//       return { error: ["Kuota device penuh"] };
//     }

//     // Tentukan Tipe
//     let finalType = "secondary";
//     if (user.device.length === 0) finalType = "primary";
//     else if (type === "primary") finalType = "primary"; // Logic promotion nanti dicek lagi kalau mau strict

//     const newDevice = {
//       deviceID,
//       type: finalType,
//       tokenVersion: 0,
//       lastUsed: new Date()
//     };

//     user.device.push(newDevice);
//     user.deviceHistory.push({ deviceID, type: finalType, action: "added" });

//     user.markModified("device");
//     user.markModified("deviceHistory");
//     await user.save();
//     await redis.del(KEY_PROFILE(userId));

//     return user.device;
//   }

//   async promoteDevice(userId, deviceID) {
//     const user = await Akun.findById(userId);
//     const device = user.device.find(d => d.deviceID === deviceID);
//     if (!device) throw createError(404, "Device not found");

//     const currentPrimary = user.device.filter(d => d.type === "primary").length;
//     if (currentPrimary >= user.maxPrimaryDevice) {
//       return { error: ["Slot Primary Device penuh"] };
//     }

//     device.type = "primary";
//     user.deviceHistory.push({ deviceID, type: "primary", action: "promoted" });

//     user.markModified("device");
//     await user.save();
//     await redis.del(KEY_PROFILE(userId));
//     return device;
//   }

//   async demoteDevice(userId, deviceID) {
//     const user = await Akun.findById(userId);
//     const device = user.device.find(d => d.deviceID === deviceID);
//     if (!device) throw createError(404, "Device not found");

//     device.type = "secondary";
//     user.deviceHistory.push({ deviceID, type: "secondary", action: "demoted" });

//     user.markModified("device");
//     await user.save();
//     await redis.del(KEY_PROFILE(userId));
//     return device;
//   }

//   async removeDevice(userId, deviceID) {
//     const user = await Akun.findById(userId);
//     const index = user.device.findIndex(d => d.deviceID === deviceID);
//     if (index === -1) throw createError(404, "Device not found");

//     const deviceType = user.device[index].type;
    
//     user.device.splice(index, 1);
//     user.deviceHistory.push({ deviceID, type: deviceType, action: "removed" });

//     user.markModified("device");
//     user.markModified("deviceHistory");
//     await user.save();
//     await redis.del(KEY_PROFILE(userId));
//     return true;
//   }

//   async getHistory(userId) {
//     const user = await Akun.findById(userId).select("deviceHistory").lean();
//     return user ? user.deviceHistory : [];
//   }
// }

// module.exports = new DeviceService();