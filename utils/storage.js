// utils/storage.js

/**
 * 存储Excel数据到本地
 * @param {string} key 存储的键名
 * @param {Object} excelData Excel数据
 * @returns {boolean} 是否存储成功
 */
export function saveExcelData(key, excelData) {
    try {
        // 如果是 Set 对象，转换为数组
        let dataToSave = excelData;
        if (excelData instanceof Set) {
            dataToSave = Array.from(excelData);
        }
        wx.setStorageSync(key, dataToSave);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * 从本地读取Excel数据
 * @param {string} key 存储的键名
 * @returns {Object|null} Excel数据
 */
export function loadExcelData(key) {
    try {
        const data = wx.getStorageSync(key);
        if (data) {
            return data;
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * 删除存储的Excel数据
 * @param {string} key 存储的键名
 */
export function removeExcelData(key) {
    try {
        wx.removeStorageSync(key);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * 检查是否存在存储的Excel数据
 * @param {string} key 存储的键名
 * @returns {boolean} 是否存在
 */
export function hasExcelData(key) {
    try {
        const data = wx.getStorageSync(key);
        return data;
    } catch (error) {
        return false;
    }
}

/**
 * 获取所有存储的Excel数据键名
 * @returns {Array} 键名数组
 */
export function getAllExcelKeys(headers = ["excel_", "txt_", "json_"]) {
    try {
        const storageInfo = wx.getStorageInfoSync();
        // 构造正则：例如 /^(excel_|txt_|json_)/
        const reg = new RegExp("^(" + headers.join("|") + ")");

        // 筛选出符合规则的 Key
        const filteredKeys = storageInfo.keys.filter((key) => reg.test(key));

        // 对 Key 进行排序
        filteredKeys.sort((a, b) => {
            // 提取时间戳：假设格式始终以 _时间戳 结尾
            const partsA = a.split("_");
            const partsB = b.split("_");

            // 获取数组最后一项并转为数字
            const timeA = parseInt(partsA[partsA.length - 1]) || 0;
            const timeB = parseInt(partsB[partsB.length - 1]) || 0;

            // 降序排序：时间戳大的排在前面
            return timeB - timeA;
        });

        return filteredKeys;
    } catch (error) {
        console.error("获取存储列表失败", error);
        return [];
    }
}

// 输出 JSON 文件
export function exportToJson(key) {
    const data = wx.getStorageSync(key);
    if (!data) {
        wx.showToast({ title: "没有可导出的数据", icon: "none" });
        return;
    }
    const jsonString = JSON.stringify(data, null, 2); // 格式化 JSON
    const fileName = `${data.displayName || "题库导出"}.json`;
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    const fs = wx.getFileSystemManager();

    try {
        fs.writeFileSync(filePath, jsonString, "utf8");

        // 直接唤起微信文件分享界面
        if (wx.shareFileMessage) {
            wx.shareFileMessage({
                filePath: filePath,
                fileName: fileName, // 可以自定义在微信里显示的文件名
                success: () => {
                    wx.showToast({ title: "已唤起分享", icon: "success" });
                },
                fail: (err) => {
                    console.error("分享失败", err);
                },
            });
        } else {
            // 低版本基础库兼容：提示用户更新
            wx.showModal({
                title: "提示",
                content: "当前微信版本过低，无法使用导出功能",
            });
        }
    } catch (e) {
        wx.showToast({ title: "文件生成失败", icon: "none" });
    }
}
