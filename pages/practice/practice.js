// practice/practice.js

// 导入搜索相关函数
import searchFunctions from './practiceType/searchFunctions.js';
import SequentialFunctions from './practiceType/SequentialFunctions.js';

const app = getApp();

Page({
    // 将搜索函数合并到页面中
    //属性合并：Behavior 里的 data 会和 Page 的 data 合并。
    //方法注入：Behavior 里的 methods 会被挂载到 this（页面实例）上。
    //优先级：如果 Page 自定义了同名函数，会覆盖 Behavior 里的函数
    behaviors: [searchFunctions, SequentialFunctions],
    data: {
        practiceType: '',   // 接收选择练习功能的参数
        pageTitle: '',

        questions: [],   // 原始总题库
        useQuestions: [],  // 过滤/排序后的实际使用题库

        currentQuestion: 0,
        excelData: null,  // 存储从全局获取的数据

        // 集合类数据使用数组存储（setData 无法直接传输 Set 对象）
        errorsSet: [],     // 错误题序集合
        collectSet: [],     // 收藏集合

        questionTypes: ['全部题型'], // 根据你的数据调整
        selectedQuestionType: '全部题型',

        isLoading: true,
        isEditMode: false,   // 是否修正模式
        startX: 0, // 触摸起始X坐标
        startY: 0  // 触摸起始Y坐标
    },

    /**
    * 加载页面
    * @param {Object} options 练习类型{type: "英文", title: "中文")对象
    */
    onLoad: function (options) {
        const { type, title } = options;
        const globalData = app.getExcelData();

        // 安全检查：如果没有数据，引导回首页
        if (!globalData) {
            wx.showModal({
                title: '数据丢失',
                content: '未找到练习数据，请重新导入',
                showCancel: false,
                success: () => wx.reLaunch({ url: '/pages/index/index' })
            });
            return;
        }

        // 初始化基础数据
        this.setData({
            practiceType: type,  // 根据 practiceType 类型显示各 UI
            pageTitle: title,
            excelData: globalData,
            isLoading: true
        }, () => {
            wx.setNavigationBarTitle({ title: title });
            this.initPractice(type);
        });
    },

    // 初始化流程
    initPractice: function (type) {
        try {
            // 初始化记录（错题/收藏）
            this.loadUserRecords();

            // 根据类型加载练习逻辑
            this.loadPracticeData(type);

            this.setData({ isLoading: false });
        } catch (e) {
            wx.showToast({ title: '题库格式错误', icon: 'none' });
        }
    },

    // 数据持久化加载
    loadUserRecords: function () {
        const key = this.data.excelData.displayName;
        // 小程序存储中 Set 会变回 Array，这里做兼容
        const errors = wx.getStorageSync("excelData_wrong_" + key) || [];
        const collects = wx.getStorageSync("excelData_favorite_" + key) || [];

        this.setData({
            errorsSet: errors,
            collectSet: collects
        });
    },

    // 根据类型加载练习逻辑
    loadPracticeData: function (type) {        
        let useQuestions = [];
        let saveName = `excelSave_${type}_${this.data.excelData.displayName}`;
        const questions = this.data.excelData.questions;
        const questionTypes = this.data.excelData.questionTypes;

        switch (type) {
            case 'sequential' || 'search':
                useQuestions = [...questions];
                break;
            case 'random':
                // 洗牌算法随机化
                useQuestions = [...questions].sort(() => Math.random() - 0.5);
                this.setData({ showTypeFilter: true });
                break;
            case 'wrong':
                useQuestions = questions.filter(q => this.data.errorsSet.includes(Number(q.id)));
                break;
            case 'favorite':
                useQuestions = questions.filter(q => this.data.collectSet.includes(Number(q.id)));
                break;
            case 'editMode':
                this.setData({ isEditMode: true });
                useQuestions = [...questions];                
                break;
            default:
                useQuestions = [...questions];
        }

        if (useQuestions.length === 0 && (type === 'wrong' || type === 'favorite')) {
            wx.showModal({
                title: '暂无记录',
                content: '未找到练习数据，请重新选择',
                showCancel: false,
                success: () => wx.reLaunch({ url: '/pages/index/index' })
            });
        }

        this.setData({ questions, questionTypes, useQuestions, saveName }, () => {
            console.log("this.data.excelData:");
                console.log(this.data.excelData);
                console.log("this.data.questions:");
                console.log(this.data.questions);
                console.log("this.data.useQuestions:");
                console.log(this.data.useQuestions);
            if ( type == "random") {
                this.loadQuestionsByType("全部题型");
            }
        });
    },

    // 返回上一页
    goBack: function () {
        this.setData({ questions: [] });
        wx.navigateBack({
            delta: 1
        });
    },

    // 页面生命周期
    onShow: function () {
        console.log('练习页面显示');
    },

    onHide: function () {
        console.log('练习页面隐藏');
    },

    onUnload: function () {
        console.log('练习页面卸载');
    },

    // 触摸开始事件
    onTouchStart(e) {
        this.setData({
            startX: e.touches[0].clientX,
            startY: e.touches[0].clientY
        });
    },

    // 触摸结束事件
    onTouchEnd(e) {
        const { startX, startY } = this.data;
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;

        // 计算滑动距离
        const diffX = endX - startX;
        const diffY = endY - startY;

        // 判断是否为水平滑动（水平距离大于垂直距离，且水平距离大于50px）
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            if (diffX > 0) {
                // 向右滑动
                this.onSwipeRight();
            } else {
                // 向左滑动
                this.onSwipeLeft();
            }
        }
    },

    // 向右滑动处理函数
    onSwipeRight() {
        if (this._swipeLock) return;
        this._swipeLock = true;

        this.prevQuestion();

        setTimeout(() => { this._swipeLock = false; }, 300);
    },

    // 向左滑动处理函数
    // 触摸交互优化：增加防抖处理，防止快速滑动导致的渲染卡顿
    onSwipeLeft() {
        if (this._swipeLock) return;
        this._swipeLock = true;

        this.nextQuestion();

        setTimeout(() => { this._swipeLock = false; }, 300);
    },

    // 点击下一题
    nextQuestion: function () {
        const currentValue = this.data.saveRecord.index || 0;
        this.changQuestion(currentValue + 1);
    },

    // 点击上一题
    prevQuestion: function () {
        const currentValue = this.data.saveRecord.index || 0;
        this.changQuestion(currentValue - 1);
    },
});