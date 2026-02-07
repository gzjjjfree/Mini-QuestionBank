// index.js
import {
    readAndSaveExcel,
    loadSavedExcel,
    extractFileName
} from '../../utils/excelParser';
import {
    removeExcelData,
    exportToJson,
    getAllExcelKeys
} from '../../utils/storage';

const app = getApp();

Page({
    data: {
        isLoading: false,
        excelData: null,  // 题库的数据结构
        hasStoredData: false,
        storageKey: 'excel_data', // 存储键名
        storedFiles: [] // 存储的文件列表
    },

    onLoad() {        
        this.initStorage();
    },

    // 统一初始化入口
    initStorage() { 
        // 页面加载时检查是否有存储的数据
        const keys = getAllExcelKeys(['xlsData_', 'xlsxData_', 'txtData_', 'jsonData_']);  // 查看已保存的题库
        const hasFiles = keys.length > 0;

        this.setData({
            storedFiles: keys,
            hasStoredData: keys,
            hasFiles
        });

        if (hasFiles) {
            // 默认加载第一个文件，或者当前已选中的 key
            const targetKey = (this.data.storageKey === 'excel_data') ? keys[0] : this.data.storageKey;

            this.loadStoredData(targetKey);
        }
    },

    /**
   * 加载并处理数据
   * @param {string} key 存储的键名
   */
    loadStoredData: function (key) {
        if (!key) return;

        try {
            const excelData = loadSavedExcel(key);

            if (excelData) {
                this.setData({
                    excelData,
                    storageKey: key
                }, () => {
                    // 同步到全局
                    app.setExcelData(excelData);
                });
                wx.showToast({ title: '加载成功', icon: 'none' });
            } else {
                throw new Error('数据为空');
            }
        } catch (err) {
            wx.showToast({ title: '加载失败', icon: 'none' });
        }
    },

    // 选择并保存文件
    async onSelectAndSaveExcel() {
        if (this.data.isLoading) return;

        this.setData({ isLoading: true });

        try {
            const fileRes = await this.chooseFile();
            const file = fileRes.tempFiles[0];

            const processFile = async () => {
                const fileName = file.name;
                const isDuplicate = this.data.storedFiles.some(item => extractFileName(item) === extractFileName(fileName));
                
                if (isDuplicate) {
                    return new Promise((resolve, reject) => {
                        wx.showModal({
                            title: '文件已存在',
                            content: `检测到同名文件 "${fileName}"，请选择操作：`,
                            confirmText: '继续加载',
                            cancelText: '取消',
                            success: async (res) => {
                                if (res.confirm) {
                                    const data = await readAndSaveExcel(file.path, fileName);
                                    resolve(data);
                                } else if (res.cancel) {
                                    reject(new Error('USER_CANCEL'));
                                } else {
                                    // 预防万一：如果既不是 confirm 也不是 cancel
                                    resolve(null);
                                }
                            },
                            fail: (err) => {
                                reject(err);
                            }
                        });
                    });
                } else {
                    return await readAndSaveExcel(file.path, fileName);
                }
            };

            const excelData = await processFile();
            console.log("读取的数据为: ")
            console.log(excelData)

            // 更新状态并刷新列表            
            this.setData({
                excelData,
                storageKey: excelData.storageKey,
                hasStoredData: true
            }, () => { this.initStorage(); });  

            wx.showToast({ title: '导入成功', icon: 'success' });
        } catch (error) {
            if (error.message !== 'USER_CANCEL') {
                wx.showToast({ title: '导入失败', icon: 'none' });
            }
        } finally {
            this.setData({ isLoading: false });
        }
    },

    
    /**
   * 切换文件并加载数据
   * @param {Event} e 事件对象
   */
    switchStoredFile(e) {
        const key = e.currentTarget.dataset.key;
        if (key === this.data.storageKey) return; // 避免重复加载
        this.loadStoredData(key);
    },

    // 删除文件
    deleteStoredData() {
        const key = this.data.storageKey;
        wx.showModal({
            title: '提示',
            content: '确定要删除当前题库吗？',
            success: (res) => {
                if (res.confirm) {
                    removeExcelData(key);
                    // 重置回默认状态
                    this.setData({ storageKey: 'excel_data' }, () => { this.initStorage(); });
                    wx.showToast({ title: '已删除' });
                }
            }
        });
    },

    /**
    * 跳转到指定的练习页面
    * @param {Event} e 事件对象
    */
    goToPractice(e) {
        if (!this.data.excelData) {
            return wx.showToast({ title: '请先导入或选择题库', icon: 'none' });
        }
        const type = e.currentTarget.dataset.type;
        const title = e.currentTarget.dataset.title || '练习';

        wx.navigateTo({
            url: `/pages/practice/practice?type=${type}&title=${title}`
        });
    },

    // 选择文件
    chooseFile() {
        return new Promise((resolve, reject) => {
            wx.chooseMessageFile({
                count: 1,
                type: 'file',
                extension: ['xls', 'xlsx', 'txt', 'txts', 'json'],
                success: resolve,
                fail: reject
            });
        });
    },

    // 导出 JSON 文件
    outStoredFilesList() {
        exportToJson(this.data.storageKey);
    }
});