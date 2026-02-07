// practice/practiceType/searchFunctions.js

export const searchFunctions = Behavior({
    methods: {
        // 搜索相关方法
        onSearchInput: function (e) {
            this.setData({
                searchKeyword: e.detail.value
            }, () => { this.onSearch(); });
        },

        onSearch: function () {
            const keyword = this.data.searchKeyword;
            if (!keyword.trim()) {
                wx.showToast({
                    title: '请输入搜索关键词',
                    icon: 'none'
                });
                return;
            }
            const lowerKeyword = keyword.toLowerCase();
            const selectedType = this.data.selectedQuestionType;
            const questions = this.data.questions;

            // 执行搜索逻辑
            // 在数据中搜索
            const searchResults = questions.filter(item => {
                if (selectedType !== '全部题型' && item['type'] !== selectedType) {
                    return false;
                }
                // 只在题目内容和选项中搜索（不搜索题号、题型等）
                const questionText = item.content || '';   // 题目内容
                const optionA = item.options.A || '';        // 选项A
                const optionB = item.options.B || '';        // 选项B
                const optionC = item.options.C || '';        // 选项C
                const optionD = item.options.D || '';        // 选项D
                const optionE = item.options.E || '';
                const optionF = item.options.F || '';
                const optionG = item.options.G || '';
                const optionH = item.options.H || '';
                const optionI = item.options.I || '';

                const searchText = `${questionText} ${optionA} ${optionB} ${optionC} ${optionD} 
            ${optionE} ${optionF} ${optionG} ${optionH} ${optionI}`.toLowerCase();

                return searchText.includes(lowerKeyword);
            });

            this.setData({
                useQuestions: searchResults
            });
        },

        // 选择题型
        searchQuestionType: function (e) {
            const type = e.currentTarget.dataset.type;

            this.setData({
                selectedQuestionType: type
            }, () => { this.onSearch(); });
        },
    }
});

// 默认导出
export default searchFunctions;