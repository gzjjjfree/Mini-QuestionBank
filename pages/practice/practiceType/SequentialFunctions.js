// practice/practiceType/SequentialFunctions.js
import { removeExcelData, saveExcelData, hasExcelData } from '../../../utils/storage';

const app = getApp();

export const SequentialFunctions = Behavior({
    data: {
        saveRecord: { index: 0, userAnswers: {} },
        exercises: [],  // 工作题库
        sequentialIndex: 0, // 总题数
        sequentialType: '', // 工作题型
        sequentialContent: '', // 显示的题干
        sequentialOptions: [],  // 显示的选项
        sequentialDifficulty: '', // 显示的难度

        selectedOptions: [],   // 当前操作的选项
        isMultipleChoice: false, // 是否背题模式
        showAnswer: false,
        isCollected: false,  // 是否收藏        

        selectedOptionsClass: [], // 选项样式类名数组
        questionStatuses: { info: { completedCount: 0, wrongCount: 0 }, status: [] },
        currentSaveName: ''  // 保存状态的文件名
    },

    methods: {
        // --- 初始化与加载 ---

        // 选择题型事件
        selectQuestionType: function (e) {
            const selectedType = e.currentTarget.dataset.type;
            this.setData({
                selectedQuestionType: selectedType,
                showTypeFilter: true
            }, () => { this.loadQuestionsByType(selectedType); });
        },


        /**
        * 加载对应题型的题目
        * @param {string} type 题目类型
        */
        loadQuestionsByType: function (type) {
            let exercises = [];
            let currentSaveName = "excelSave_" + this.data.practiceType + "_" + type + "_" + this.data.excelData.displayName;

            if (type === '全部题型') {
                exercises = this.data.useQuestions;
            } else {
                exercises = this.data.useQuestions.filter(q => q['type'] === type);
            }

            if (exercises.length == 0) {
                this.goBack();
                wx.showToast({
                    title: '找不到题目',
                    icon: 'none'
                });
            };

            const loadRecord = hasExcelData(currentSaveName) || { index: 0, userAnswers: {} };
            console.log(exercises);
            this.setData({ saveRecord: loadRecord, exercises, currentSaveName }, () => {
                this.updateAllQuestionStatuses();
                this.showQuestions(); // 显示题目
            });
        },

        // --- 核心显示逻辑 ---

        showQuestions: function () {
            const saveRecord = this.data.saveRecord;
            let idx = saveRecord.index || 0;
            let question = this.data.exercises[idx];
            console.log(saveRecord);
            if (!question) {
                idx = this.data.exercises.length - 1;
                question = this.data.exercises[idx];
                if (!question) return;
                this.setData ({ 
                    [`saveRecord.index`]: idx
                });
            }

            console.log(question);
            const userAnswer = saveRecord.userAnswers && saveRecord.userAnswers[idx];
            const qType = question.type || "";

            // --- 新增：背题模式判断 ---
            const isMemorizeMode = qType.includes("填空") || qType.includes("问答");

            let options = [];
            if (isMemorizeMode) {
                // 如果是背题模式，选项只显示一个
                options = ["点击显示答案"];
            } else {
                // 选择题逻辑
                const optObj = question.options || {};
                const optionKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
                options = optionKeys
                    .map(key => optObj[key])
                    .filter(val => val !== undefined && val !== null);
            }

            this.setData({
                sequentialIndex: question.id,
                saveRecordIndex: idx,
                sequentialType: qType,
                sequentialContent: question.content,
                sequentialOptions: options,
                sequentialDifficulty: question.difficulty || '普通',
                selectedOptions: userAnswer ? userAnswer.selected : [],
                showAnswer: !!userAnswer,
                correctOptionIndex: isMemorizeMode ? [0] : this.getCorrectOptionIndex(question.answer),
                isMultipleChoice: isMemorizeMode ? false : qType.indexOf("多选") !== -1,
                isCollected: this.getIsCollect(question.id)
            }, () => {
                this.updateOptionsClass();
            });
        },

        // --- 交互逻辑 ---

        selectOption: function (e) {
            if (this.data.showAnswer) return;

            const idx = e.currentTarget.dataset.index;
            const qType = this.data.sequentialType;
            const isMemorizeMode = qType.includes("填空") || qType.includes("问答");

            if (isMemorizeMode) {
                // 背题模式：点击直接显示答案
                this.setData({ selectedOptions: [0] }, () => {
                    this.submitMemorizeAnswer(); // 使用专门的提交逻辑
                });
            } else {
                // 单选/多选逻辑
                let selected = [...this.data.selectedOptions];
                if (this.data.isMultipleChoice) {
                    const pos = selected.indexOf(idx);
                    pos > -1 ? selected.splice(pos, 1) : selected.push(idx);
                    this.setData({ selectedOptions: selected }, () => this.updateOptionsClass());
                } else {
                    this.setData({ selectedOptions: [idx] }, () => this.submitAnswer());
                }
            }
        },

        submitAnswer: function () {
            if (this.data.showAnswer) return;

            const currentIdx = this.data.saveRecord.index;
            const correct = [...this.data.correctOptionIndex].sort();
            const selected = [...this.data.selectedOptions].sort();

            const isCorrect = JSON.stringify(correct) === JSON.stringify(selected);

            // 更新本地错题集（注意转换 Set 为 Array 存储）
            const globalIndex = Number(this.data.exercises[currentIdx]['id']);
            const newErrors = new Set(this.data.errorsSet);
            isCorrect ? newErrors.delete(globalIndex) : newErrors.add(globalIndex);

            this.setData({
                showAnswer: true,
                errorsSet: Array.from(newErrors)
            }, () => {
                // 记录答案
                this.recordAnswer(currentIdx, selected, isCorrect);
            });

            if (!isCorrect) {
                wx.showToast({ title: '回答错误', icon: 'none' });
            } else {
                // 单选题答对自动下一题
                setTimeout(() => this.nextQuestion(), 500);
            }
        },

        // --- 样式管理 ---

        updateOptionsClass: function () {
            const { selectedOptions, correctOptionIndex, showAnswer, sequentialType } = this.data;
            const isMemorizeMode = sequentialType.includes("填空") || sequentialType.includes("问答");

            const classArray = this.data.sequentialOptions.map((_, i) => {
                if (isMemorizeMode) {
                    // 背题模式样式：如果已展示，显示 special 样式
                    return showAnswer ? 'memorize-show' : 'memorize-hide';
                }

                const isSelected = selectedOptions.includes(i);
                const isCorrect = correctOptionIndex.includes(i);
                let cls = isSelected ? 'selected' : '';
                if (showAnswer) {
                    if (isCorrect) cls += ' correct';
                    if (isSelected && !isCorrect) cls += ' wrong';
                }
                return cls.trim();
            });

            this.setData({ selectedOptionsClass: classArray });
        },

        // --- 辅助方法 ---

        recordAnswer: function (idx, selected, isCorrect) {
            const userAnswers = { ...this.data.saveRecord.userAnswers };
            userAnswers[idx] = {
                selected,
                isCorrect,
                timestamp: Date.now()
            };

            this.setData({
                [`saveRecord.userAnswers`]: userAnswers,
                ['questionStatuses.info.completedCount']: this.data.questionStatuses.info.completedCount + 1,
                ['questionStatuses.info.wrongCount']: !isCorrect ? this.data.questionStatuses.info.wrongCount + 1 : this.data.questionStatuses.info.wrongCount,
                [`questionStatuses.status[${idx}]`]: isCorrect ? 'correct' : 'wrong'
            }, () => {
                const key = this.data.currentSaveName;
                saveExcelData(key, this.data.saveRecord);

                saveExcelData("excelData_wrong_" + this.data.excelData.displayName, this.data.errorsSet);
                this.updateOptionsClass();
            });
        },

        getIsCollect: function (qNum) {
            const num = Number(qNum);
            // 兼容 Array 和 Set 的判断
            return this.data.collectSet.includes ?
                this.data.collectSet.includes(num) :
                this.data.collectSet.has(num);
        },

        // --- 进度与状态统计 ---

        // 根据正确答案获取选项索引
        getCorrectOptionIndex: function (correctAnswer) {
            console.log("correctAnswer: " + correctAnswer);
            if (!correctAnswer) return [0];

            const answer = correctAnswer.toString().toUpperCase().trim();
            // 完整的选项映射表，包含全角和半角
            const optionMap = {
                // 半角大写
                'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8,
                // 全角大写  
                'Ａ': 0, 'Ｂ': 1, 'Ｃ': 2, 'Ｄ': 3, 'Ｅ': 4, 'Ｆ': 5, 'Ｇ': 6, 'Ｈ': 7, 'Ｉ': 8,
                // 半角小写（转换为大写后不会出现，但为了完整性）
                'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, 'f': 5, 'g': 6, 'h': 7, 'i': 8,
                // 全角小写
                'ａ': 0, 'ｂ': 1, 'ｃ': 2, 'ｄ': 3, 'ｅ': 4, 'ｆ': 5, 'ｇ': 6, 'ｈ': 7, 'ｉ': 8
            };

            let answers = [];

            // 处理逗号分隔的答案（如 "A,C" 或 "A, C"）
            if (answer.includes(',')) {
                answers = answer.split(',').map(item => item.trim());
            }
            // 处理无分隔符的答案（如 "AC" 或 "AB"）
            else {
                answers = answer.split('');
            }

            // 过滤有效选项并转换为索引
            const indices = answers
                .map(char => optionMap[char])
                .filter(index => index !== undefined)
                .sort((a, b) => a - b); // 可选：按索引排序

            return indices.length > 0 ? indices : [0];
        },

        // 更新所有题目的答题状态
        updateAllQuestionStatuses: function () {
            // 提前取出数据，避免在循环中频繁访问 this.data
            const { exercises, saveRecord } = this.data;
            const userAnswers = (saveRecord && saveRecord.userAnswers) || {};

            // 初始化统计对象
            let completedCount = 0;
            let wrongCount = 0;
            const statusArray = new Array(exercises.length);

            // 遍历逻辑
            for (let i = 0; i < exercises.length; i++) {
                const record = userAnswers[i];

                if (!record) {
                    statusArray[i] = 'unanswered';
                    continue;
                }

                // 已答题
                completedCount++;
                if (record.isCorrect) {
                    statusArray[i] = 'correct';
                } else {
                    statusArray[i] = 'wrong';
                    wrongCount++;
                }
            }

            this.setData({
                questionStatuses: {
                    info: { completedCount, wrongCount },
                    status: statusArray
                }
            });
        },

        /**
        * 获取答题状态
        * @param {int} index 进度记录的序号
        */
        getQuestionStatus: function (index) {
            const record = this.data.saveRecord?.userAnswers?.[index];
            if (!record) return 'unanswered';
            return record.isCorrect ? 'correct' : 'wrong';
        },

        /**
        * 跳转到指定题目
        * @param {int} index 工作题库的序号
        */
        changQuestion: function (index) {
            if (index >= 0 && index < this.data.exercises.length) {
                this.setData({
                    [`saveRecord.index`]: index
                }, () => {
                    this.showQuestions(this.data.saveRecord);
                    saveExcelData(this.data.currentSaveName, this.data.saveRecord);
                });
            } else {
                wx.showToast({
                    title: '已经是最后一题',
                    icon: 'none'
                });
            }
        },

        // 返回题型列表
        goBackToTypeSelection: function () {
            this.setData({
                showTypeFilter: false,
                saveRecord: {}
            })
        },

        // 打开题目列表
        goQuestions: function () {
            this.setData({
                showQuestionList: true
            });
        },

        // 关闭题目列表
        closeQuestionList: function () {
            this.setData({
                showQuestionList: false
            });
        },

        // 从列表中选择题目
        selectQuestionFromList: function (e) {
            const index = e.currentTarget.dataset.index;

            // 跳转到选中的题目
            this.changQuestion(index);

            // 关闭弹窗
            this.closeQuestionList();
        },

        // 删除记录
        delSequential: function () {
            let delName = this.data.currentSaveName;

            const del = removeExcelData(delName);

            if (del) {
                wx.showToast({
                    title: '数据已删除',
                    icon: 'success'
                });
            } else {
                wx.showToast({
                    title: '删除失败',
                    icon: 'none'
                });
                return;
            }
            this.setData({
                saveRecord: {},
                [`saveRecord.index`]: 0
            }, () => {
                this.updateAllQuestionStatuses();
                this.showQuestions(this.data.saveRecord);
            });

            if (this.data.practiceType == "wrong") {
                delName = "excelData_wrong_" + this.data.excelData.displayName;
                removeExcelData(delName);
                this.setData({
                    exercises: []
                }, () => { this.goBack() });
            }
        },

        // 收藏习题
        setCollect: function () {
            const collectSet = new Set(this.data.collectSet);
            const globalIndex = Number(this.data.exercises[this.data.saveRecord.index]["id"]);
            const isCollected = this.getIsCollect(globalIndex);
            isCollected ? collectSet.delete(globalIndex) : collectSet.add(globalIndex);

            this.setData({
                isCollected: !isCollected,
                collectSet: Array.from(collectSet)
            }, () => {
                saveExcelData("excelData_favorite_" + this.data.excelData.displayName, Array.from(collectSet));
            });
        },

        submitMemorizeAnswer: function () {
            const currentIdx = this.data.saveRecord.index;

            this.setData({
                showAnswer: true
            }, () => {
                // 记录为已读/已背，这里 isCorrect 默认为 true
                this.recordAnswer(currentIdx, [0], true);
            });
        },

        // 同步修改题干
        onEditContent: function (e) {
            this.setData({ sequentialContent: e.detail.value });
        },

        // 同步修改选项
        onEditOption: function (e) {
            const idx = e.currentTarget.dataset.index || 0;
            let options = [...this.data.sequentialOptions];
            options[idx] = e.detail.value;

            this.setData({ sequentialOptions: options });
        },

        // 增加一个空选项
        addOption: function () {
            if (this.data.sequentialOptions.length >= 9) return;
            this.setData({
                sequentialOptions: [...this.data.sequentialOptions, "新选项内容"]
            });
        },

        // 保存当前题目到内存中的 exercises 数组
        saveCurrentQuestion: function () {
            const idx = this.data.saveRecord.index;
            let exercises = [...this.data.exercises];

            // 更新当前题目对象
            exercises[idx].content = this.data.sequentialContent;

            if (this.data.sequentialType != '填空题' && this.data.sequentialType != '问答题') {
                const finalOptions = this.data.sequentialOptions.filter(opt => opt.trim() !== "");
                this.setData({ sequentialOptions: finalOptions }, () => {
                    // 将数组格式的 options 转回对象格式 {A: "", B: ""}
                    const optionKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
                    let newOptionsObj = {};
                    finalOptions.forEach((text, i) => {
                        newOptionsObj[optionKeys[i]] = text;
                    });

                    exercises[idx].options = newOptionsObj;
                })
            } else {
                // 只有条件成立才执行赋值
                this.data.sequentialOptions[0] !== "点击显示答案" && (exercises[idx].options.A = this.data.sequentialOptions);
            }
            console.log("exercises");
            console.log(exercises);
            this.setData({ exercises }, () => {
                // 持久化到本地缓存
                this.saveMerge();
            });
        },

        // 将修正题库合并到总题库
        saveMerge: function () {
            const { excelData, exercises, sequentialType } = this.data;
            const storageKey = excelData.storageKey;
            let updatedExcelData = {};

            if (this.data.sequentialType != '全部题型') {
                // 定义题型排序权重 (越小越靠前)
                const typeOrder = {
                    "填空题": 1,
                    "单选题": 2,
                    "多选题": 3,
                    "判断题": 4,
                    "问答题": 5,
                    "其他": 99 // 未知题型排最后
                };

                // 剔除原总库中当前正在编辑的题型，合并新数据
                let otherTypeQuestions = excelData.questions.filter(q => q.type !== sequentialType);
                let combinedQuestions = [...otherTypeQuestions, ...exercises];

                // 按照预设的题型顺序进行排序
                combinedQuestions.sort((a, b) => {
                    const orderA = typeOrder[a.type] || typeOrder["其他"];
                    const orderB = typeOrder[b.type] || typeOrder["其他"];

                    // 如果题型相同，可以保持原有的相对顺序（按 content 或 保持不变）
                    if (orderA === orderB) {
                        return 0;
                    }
                    return orderA - orderB;
                });

                // 排序后，重新梳理 ID
                const finalQuestions = combinedQuestions.map((q, index) => {
                    return {
                        ...q,
                        id: index + 1 // 此时 ID 是按题型顺序连续生成的
                    };
                });

                const types = ['全部题型', ...new Set(finalQuestions.map(q => q.type))];

                // 更新内存并持久化
                updatedExcelData = {
                    ...excelData,
                    questions: finalQuestions,
                    questionTypes: Array.from(types)
                };
            } else {
                updatedExcelData = {
                    ...excelData,
                    questions: exercises
                };
            }

            wx.showLoading({ title: '正在重新排版...' });
            app.setExcelData(updatedExcelData);

            this.setData({
                excelData: updatedExcelData
            }, () => {
                try {
                    wx.hideLoading();
                    wx.setStorageSync(storageKey, updatedExcelData);

                    // 重新定位当前正在显示的题目，防止因排序导致页面显示的题目对不上
                    this.showQuestions();
                } catch (e) {
                    wx.hideLoading();
                    wx.showToast({ title: '保存失败', icon: 'none' });
                }
            });
        },

        // 在当前位置插入新题
        addNewQuestion: function () {
            const typeList = ['填空题', '单选题', '多选题', '判断题', '问答题'];

            wx.showActionSheet({
                itemList: typeList,
                success: (res) => {
                    const selectedType = typeList[res.tapIndex];

                    // 如果是多选题，弹出输入框让用户输入 ABC
                    if (selectedType === '多选题') {
                        wx.showModal({
                            title: '设置多选答案',
                            content: '',
                            placeholderText: '请输入正确选项A-I,如:BDE',
                            editable: true, // 开启输入框
                            success: (modalRes) => {
                                if (modalRes.confirm) {
                                    // 将输入转为大写并格式化（排序）
                                    const answer = modalRes.content.toUpperCase().split('').sort().join('');
                                    this.executeAdd(selectedType, answer);
                                }
                            }
                        });
                    } else if (selectedType === '判断') {
                        const answerList = ['A', 'B'];
                        wx.showActionSheet({
                            itemList: answerList,
                            success: (actionRes) => {
                                this.executeAdd(selectedType, answerList[actionRes.tapIndex]);
                            }
                        });
                    } else {
                        // 单选、填空等的逻辑
                        const answerList = ['A', 'B', 'C', 'D'];
                        wx.showActionSheet({
                            itemList: answerList,
                            success: (actionRes) => {
                                this.executeAdd(selectedType, answerList[actionRes.tapIndex]);
                            }
                        });
                    }
                }
            });
        },

        executeAdd: function (type, answer) {
            const { excelData } = this.data;

            // 初始化新题目基础结构
            let newQuestion = {
                id: -1, // 临时 ID，后续统一重新梳理
                type: type,
                content: "新题目内容...",
                answer: answer,
                options: {},
            };

            // 根据题型定制选项逻辑
            if (type === '填空题' || type === '问答题') {
                newQuestion.options = { A: "" }; // 只有 A 选项作为答案容器
            } else if (type === '判断题') {
                newQuestion.options = { A: "正确", B: "错误" };
            } else {
                // 单选、多选：默认给四个空选项
                newQuestion.options = { A: "", B: "", C: "", D: "", E: "", F: "", G: "", H: "", I: "" };
            }

            // 合并到总题库中同题型
            // 寻找该题型集合, 插入新题
            let updatedQuestions = this.data.useQuestions.filter(q => q['type'] === type);
            let lastList = -1;

            if (this.data.sequentialType == type) {
                lastList = this.data.saveRecord.index + 1;
                updatedQuestions.splice(this.data.saveRecord.index + 1, 0, newQuestion);
            } else if (this.data.sequentialType == "全部题型") {
                lastList = Number(updatedQuestions[updatedQuestions.length - 1].id);
                updatedQuestions.push(newQuestion);
            } else {
                lastList = updatedQuestions.length;
                updatedQuestions.push(newQuestion);
            }
            // 对集合重新排序
            const exercises = updatedQuestions.map((q, idx) => ({ ...q, id: idx + 1 }));

            // 刷新当前记录状态
            let currentSaveName = "excelSave_" + this.data.practiceType + "_" + type + "_" + this.data.excelData.displayName;
            let loadRecord = hasExcelData(currentSaveName) || { index: 0, userAnswers: {} };
            loadRecord.index = lastList;

            this.setData({
                exercises,
                sequentialType: type,
                saveRecord: loadRecord
            }, () => {
                // 持久化到本地缓存                
                this.saveMerge();
                wx.showToast({ title: '已添加新题，请编辑' });
            });
        },

        // 删除题目
        // 删除当前显示的题目
        deleteCurrentQuestion: function () {
            const { exercises, saveRecord, sequentialType } = this.data;
            const currentIndex = saveRecord.index;

            if (!exercises || exercises.length === 0) {
                return wx.showToast({ title: '没有可删除的题目', icon: 'none' });
            }

            wx.showModal({
                title: '删除确认',
                content: `确定要删除第 ${currentIndex + 1} 题吗？此操作不可撤销。`,
                confirmColor: '#ff4d4f',
                success: (res) => {
                    if (res.confirm) {
                        wx.showLoading({ title: '正在删除...' });

                        // 1. 创建副本并删除当前索引的题目
                        let updatedExercises = [...exercises];
                        updatedExercises.splice(currentIndex, 1);

                        // 2. 处理删除后的索引：如果删的是最后一题，索引减1；否则保持不变
                        let nextIndex = currentIndex;
                        if (nextIndex >= updatedExercises.length && updatedExercises.length > 0) {
                            nextIndex = updatedExercises.length - 1;
                        } else if (updatedExercises.length === 0) {
                            nextIndex = 0;
                        }

                        // 3. 清理并重构 saveRecord
                        // 因为删除题目会导致后续所有题目的 ID/索引 发生变化
                        // 最安全的方法是清空当前题型的 userAnswers，或者重新对齐映射
                        let newUserAnswers = {};

                        // 【关键修正：增加逻辑判断，防止 null 报错】
                        const currentAnswers = saveRecord && saveRecord.userAnswers ? saveRecord.userAnswers : {};

                        // 只有当原来的答题记录不为空时，才执行平移逻辑
                        Object.keys(currentAnswers).forEach(key => {
                            const idx = parseInt(key);
                            if (idx < currentIndex) {
                                // 索引在删除位之前的，保留
                                newUserAnswers[idx] = currentAnswers[idx];
                            } else if (idx > currentIndex) {
                                // 索引在删除位之后的，向前平移一位
                                newUserAnswers[idx - 1] = currentAnswers[idx];
                            }
                            // 注意：idx === currentIndex 的那项被自然丢弃，实现了清理
                        });

                        // 3. 准备新的记录状态
                        let newRecord = {
                            ...saveRecord,
                            index: nextIndex,
                            userAnswers: newUserAnswers
                        };

                        // 4. 更新局部状态
                        this.setData({
                            exercises: updatedExercises,
                            saveRecord: newRecord
                        }, () => {
                            // 5. 调用你现有的 saveMerge 逻辑
                            // 它会自动完成：剔除旧数据、合并 updatedExercises、重排、梳理ID、保存缓存
                            this.saveMerge();

                            // 额外一步：因为 saveRecord 变了，需要手动同步到它自己的缓存
                            let currentSaveName = "excelSave_" + this.data.practiceType + "_" + sequentialType + "_" + this.data.excelData.displayName;
                            wx.setStorageSync(currentSaveName, newRecord);

                            wx.showToast({ title: '删除成功' });
                        });
                    }
                }
            });
        },
    }
});

export default SequentialFunctions;