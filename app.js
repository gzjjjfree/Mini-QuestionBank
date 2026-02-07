// app.js
App({
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      }
    })
  },
  globalData: {
    excelData: null,
    userInfo: null
  },

  // 设置 Excel 数据的方法
  setExcelData: function(data) {
    this.globalData.excelData = data;
  },
  
  // 获取 Excel 数据的方法
  getExcelData: function() {
    return this.globalData.excelData;
  }
})
