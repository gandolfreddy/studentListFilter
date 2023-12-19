// ==UserScript==
// @name         學生資料過濾器
// @namespace    http://tampermonkey.net/
// @version      1.0
// @source       https://raw.githubusercontent.com/gandolfreddy/studentListFilter/main/src/studentListFilter.js
// @namespace    https://raw.githubusercontent.com/gandolfreddy/studentListFilter/main/src/studentListFilter.js
// @description  過濾出需要的學生名單
// @author       您的名字
// @match        https://corp.orangeapple.co/marketing/sales/admission_count*
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    // 加入 CSS
    GM_addStyle(`
        .floating-message-window-shrinked {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            background-color: rgb(52,196,168, 0.8);
            color: #fff;
            font-weight: bold;
            font-size: 14px;
            font-family: "consolas";
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: 2px solid #fff;
            cursor: pointer;

            display: flex;
            justify-content: center;
            align-items: center;
        }
        .floating-message-window-shrinked:hover {
            background-color: rgb(52,196,168, 0.6);
        }
        .floating-message-window-extended {
            font-family: "consolas";
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            background-color: #fff;
            color: #000;
            width: 500px;
            height: 600px;
            padding: 10px 20px 30px 20px;
            border-radius: 8px;
            border: 2px solid rgb(0, 0, 0, 0.5);
            cursor: default;

            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: center;
        }
        #floating-message-window-title {
            font-size: 25px;
            font-weight: bold;
            color: rgb(0, 0, 0, 0.7);
        }
        #studentList {
            width: 100%;
            height: 100%;
            overflow: auto;
            padding: 10px;
            box-sizing: border-box;
            font-family: "consolas";
        }
        #studentList > .card {
            box-shadow: 0 0 6px rgb(0, 0, 0, 0.5);
            width: 90%;
            margin: 10px;
        }
        /* width */
        #studentList::-webkit-scrollbar {
            width: 8px;
        }
        /* Track */
        #studentList::-webkit-scrollbar-track {
            background: #f1f1f1; 
        }
        /* Handle */
        #studentList::-webkit-scrollbar-thumb {
            background: rgb(52,196,168, 0.7);
        }
        /* Handle on hover */
        #studentList::-webkit-scrollbar-thumb:hover {
            background: rgb(52,196,168, 0.4);
        }
        .dragging {
            cursor: grabbing;
        }
    `);

    // 資料來源網址
    const HREF = "https://corp.orangeapple.co/marketing/sales/admission_count";

    // 年級
    const GRADE = {
        "一年級": 1,
        "小一": 1,
        "二年級": 2,
        "小二": 2,
        "三年級": 3,
        "小三": 3,
        "四年級": 4,
        "小四": 4,
        "五年級": 5,
        "小五": 5,
        "六年級": 6,
        "小六": 6,
        "七年級": 7,
        "國一": 7,
        "八年級": 8,
        "國二": 8,
        "九年級": 9,
        "國三": 9,
        "十年級": 10,
        "高一": 10,
        "十一年級": 11,
        "高二": 11,
        "十二年級": 12,
        "高三": 12,
    };

    // 課程階段
    const LESSONS = {
        "Lesson1": 1,
        "Lesson2": 2,
        "Lesson3": 3,
        "Lesson4": 4,
        "Lesson5": 5,
        "Lesson6": 6,
        "Lesson7": 7,
        "Lesson8": 8,
        "Lesson9": 9,
        "Lesson10": 10,
        "Lesson11": 11,
        "Lesson12": 12,
        "Lesson13": 13,
        "Lesson14": 14,
        "Lesson15": 15,
    }

    // SPINNER 用來顯示更新時圖示
    const SPINNER = `
    <div class="spinner-border text-success my-2" role="status">
        <span class="visually-hidden">Loading...</span>
    </div>
    `;

    // TITLEHINT 用來顯示功能提示
    const TITLEHINT = {
        updateRawData: "更新高雄區學生名單資料（學生名單有更動再執行即可）",
        APCS: "過濾出九年級（含）以上的學生",
        ITSPython: "過濾出進度為 Python 程式開發班 L12~L15 的學生",
        TQCAPP: "過濾出進度為 Scratch 菁英班、實戰班 L12~L15 的學生",
    }

    // studentListLogging 用來記錄更新時的狀態
    let studentListLogging = '';

    // 從瀏覽器的 localStorage 取得資料
    let allInfo = JSON.parse(localStorage.getItem("allInfo")) || {
        rawData: [],
        APCS: [],
        ITSPython: [],
        TQCAPP: [],
    };;

    // 取得資料來源頁面中高雄所有教室的學生列表連結
    let khTrs = Array
        .from(document.querySelectorAll("table.table.table-bordered tbody tr"))
        .filter(tr => tr.innerHTML.includes("高雄") && !tr.innerHTML.includes("小計"));
    let khStudentListLinks = [];
    for (let tr of khTrs) {
        let aTags = Array.from(tr.querySelectorAll('a'));
        for (let a of aTags) {
            khStudentListLinks.push(a.href);
        }
    }

    // 加入懸浮訊息小視窗，並加入點擊事件，點選後會展開小視窗，並顯示學生名單
    let isExtended = false,
        isUpdating = false;
    let circle = addFloatingMessageWindow();
    let preCircleLeft = circle.getBoundingClientRect().left,
        preCircleTop = circle.getBoundingClientRect().top;
    circle.addEventListener("click", showExtendedFloatingMessageWindow, true);

    // rawData 處理函式
    async function processRawData(khStudentListLinks) {
        // 處理不允許的操作
        isUpdating = true;
        let studentList = document.querySelector("#studentList");
        studentList.innerHTML = studentListLogging;
        document.querySelector("#updateRawData").disabled = true;
        document.querySelector("#downloadData").disabled = true;
        document.querySelector("#buttonAPCS").disabled = true;
        document.querySelector("#buttonITSPython").disabled = true;
        document.querySelector("#buttonTQCAPP").disabled = true;

        // 開始更新 rawData
        let resultRawData = [];
        for (let link of khStudentListLinks) {
            studentListLogging += `
            <div class="alert alert-primary" role="alert">
                正在處理 <a href='${link}' target="_blank">學生名單</a>
            </div>
            `;
            if (isExtended) {
                document.querySelector("#studentList").innerHTML = studentListLogging + SPINNER;
            }
            let res = await fetch(link).then(res => res.text());
            let currentPageDOM = new DOMParser().parseFromString(res, 'text/html');
            let page = 1;
            while (true) {
                studentListLogging += `
                <div class="alert alert-warning" role="alert">
                    正在處理第 ${page} 頁
                </div>
                `;
                if (isExtended) {
                    document.querySelector("#studentList").innerHTML = studentListLogging + SPINNER;
                }
                let tbody = currentPageDOM.querySelector("table.table-striped tbody");
                let availableTrs = Array
                    .from(tbody.querySelectorAll('tr'));
                for (let tr of availableTrs) {
                    let tds = tr.querySelectorAll('td');
                    let studentName = tds[0].innerText;
                    let courseName = tds[3].innerText;
                    courseName = courseName.slice(0, courseName.indexOf('('));

                    let personalInfoHref = '', studentGrade = '';
                    personalInfoHref = tds[1].querySelector('a')?.href;
                    if (personalInfoHref) {
                        let personalInfo = await fetch(personalInfoHref).then(res => res.text());
                        personalInfo = new DOMParser().parseFromString(personalInfo, 'text/html');
                        let personalInfoTrs = Array
                            .from(personalInfo.querySelectorAll("table.table.table-bordered.table-hover tbody tr"))
                            .filter(tr => tr.querySelectorAll('td')[0].innerText.includes(studentName));
                        studentGrade = personalInfoTrs[0].querySelectorAll('td')[1].innerText;
                    }

                    let lessonInfoHref = '', latestLessonStatus = '', latestFinishStatus = '';
                    lessonInfoHref = tds[4].querySelector('a')?.href;
                    if (lessonInfoHref) {
                        let lessonInfo = await fetch(lessonInfoHref).then(res => res.text());
                        lessonInfo = new DOMParser().parseFromString(lessonInfo, 'text/html');
                        let lessonInfoTrs = Array
                            .from(lessonInfo.querySelectorAll("table.table.table-bordered.table-text-center tbody tr"))
                            .reverse()
                            .filter(tr => tr.innerText.includes("最新課程階段"));
                        latestLessonStatus = lessonInfoTrs[0].querySelector('div:nth-child(2) > div:nth-child(1)').innerText;
                        latestLessonStatus = latestLessonStatus.slice(latestLessonStatus.indexOf('：') + 1).replace(/\s/g, '');
                        latestFinishStatus = lessonInfoTrs[0].querySelector('div:nth-child(2) > div:nth-child(2)').innerText;
                        latestFinishStatus = latestFinishStatus.slice(latestFinishStatus.indexOf('：') + 1).replace(/\s/g, '');
                    }

                    resultRawData.push({
                        "姓名": studentName,
                        "課程名稱": courseName,
                        "年級": studentGrade,
                        "最新課程階段": latestLessonStatus,
                        "最新完成狀態": latestFinishStatus,
                        "家長資料網址": personalInfoHref,
                        "課堂紀錄網址": lessonInfoHref,
                    });
                }

                // 如果有下一頁，取得下一頁的資料
                let nextPageBtn = currentPageDOM.querySelector(".page-link[rel=next]");
                let nextPageHref = nextPageBtn?.href;
                if (nextPageHref) {
                    await fetch(nextPageHref).then(res => res.text()).then(res => {
                        let parser = new DOMParser();
                        currentPageDOM = parser.parseFromString(res, 'text/html');
                        page++;
                    });
                } else {
                    break;
                }

                // 等待頁面更新，避免抓到舊的資料，等 2 秒
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        // 顯示依年級排序後的結果
        allInfo.rawData = resultRawData.sort((a, b) => GRADE[a["年級"]] - GRADE[b["年級"]]);
        // 儲存至瀏覽器的 localStorage
        localStorage.setItem("allInfo", JSON.stringify(allInfo));

        // 將不允許的操作還原
        isUpdating = false;
        if (!isExtended) showExtendedFloatingMessageWindow();
        studentList = document.querySelector("#studentList");
        studentListLogging = `
        <div class="alert alert-success" role="alert">
            資料更新完成！
        </div>`;
        studentList.innerHTML = studentListLogging;
        document.querySelector("#updateRawData").disabled = false;
        document.querySelector("#downloadData").disabled = false;
        document.querySelector("#buttonAPCS").disabled = false;
        document.querySelector("#buttonITSPython").disabled = false;
        document.querySelector("#buttonTQCAPP").disabled = false;
    }

    // APCS 處理函式
    async function processAPCS(khStudentListLinks) {
        /* 
            過濾出 

            年級 -> 大於等於 9,

            的學生名單
        */
        let resultAPCS = [];
        let rawData = JSON.parse(localStorage.getItem("allInfo"))?.rawData || [];
        if (rawData.length === 0) {
            await processRawData(khStudentListLinks);
        }
        rawData = JSON.parse(localStorage.getItem("allInfo"))?.rawData || [];
        for (let student of rawData) {
            if (GRADE[student["年級"]] >= 9) {
                resultAPCS.push(student);
            }
        }
        // 顯示依年級排序後的結果
        allInfo.APCS = resultAPCS
            .sort((a, b) => GRADE[a["年級"]] - GRADE[b["年級"]]);
        // 儲存至瀏覽器的 localStorage
        localStorage.setItem("allInfo", JSON.stringify(allInfo));
        // 顯示於 #studentList 中
        showStudentList(allInfo.APCS);
    }

    // ITSPython 處理函式
    async function processITSPython(khStudentListLinks) {
        /* 
            過濾出 

            課程名稱 -> 菁英_Python程式開發班,
            最新課程階段 -> 大於等於 12,

            的學生名單
        */
        let resultITSPython = [];
        let rawData = JSON.parse(localStorage.getItem("allInfo"))?.rawData || [];
        if (rawData.length === 0) {
            await processRawData(khStudentListLinks);
        }
        rawData = JSON.parse(localStorage.getItem("allInfo"))?.rawData || [];
        for (let student of rawData) {
            if (student["課程名稱"] === "菁英_Python程式開發班"
                && LESSONS[student["最新課程階段"]] >= 12
                && student["最新完成狀態"] === "完整完成") {
                resultITSPython.push(student);
            }
        }

        // 顯示依年級排序後的結果
        allInfo.ITSPython = resultITSPython
            .sort((a, b) => GRADE[a["年級"]] - GRADE[b["年級"]]);
        // 儲存至瀏覽器的 localStorage
        localStorage.setItem("allInfo", JSON.stringify(allInfo));
        // 顯示於 #studentList 中
        showStudentList(allInfo.ITSPython);
    }

    // TQC+ APP 處理函式
    async function processTQCAPP(khStudentListLinks) {
        /* 
            過濾出 

            課程名稱 -> 菁英_Scratch菁英班3.0 或 菁英_Scratch實戰班3.0,
            最新課程階段 -> 大於等於 12,

            的學生名單
        */
        let resultTQCAPP = [];
        let rawData = JSON.parse(localStorage.getItem("allInfo"))?.rawData || [];
        if (rawData.length === 0) {
            await processRawData(khStudentListLinks);
        }
        rawData = JSON.parse(localStorage.getItem("allInfo"))?.rawData || [];
        for (let student of rawData) {
            if ((student["課程名稱"] === "菁英_Scratch菁英班3.0" || student["課程名稱"] === "菁英_Scratch實戰班3.0")
                && LESSONS[student["最新課程階段"]] >= 12) {
                resultTQCAPP.push(student);
            }
        }
        // 顯示依年級排序後的結果
        allInfo.TQCAPP = resultTQCAPP
            .sort((a, b) => GRADE[a["年級"]] - GRADE[b["年級"]]);
        // 儲存至瀏覽器的 localStorage
        localStorage.setItem("allInfo", JSON.stringify(allInfo));
        // 顯示於 #studentList 中
        showStudentList(allInfo.TQCAPP);
    }

    // 學生名單顯示函式
    function showStudentList(chosenStudentList) {
        /* 
        學生名單顯示 
        功能：顯示對應課程的學生名單。
        */
        // 將 #studentList 的畫面捲動至最上方
        document.querySelector("#studentList").scrollTop = 0;
        // 顯示結果
        document.querySelector("#studentList").innerHTML = "";
        if (chosenStudentList.length === 0) {
            document.querySelector("#studentList").innerHTML = `
            <div class="alert alert-danger" role="alert">
                無符合條件的學生
            </div>`;
            return;
        }
        for (let student of chosenStudentList) {
            document.querySelector("#studentList").innerHTML += `
            <div class="card">
                <div class="card-header text-bg-primary">
                    <h4 class="card-title">${student["姓名"]}</h4>
                </div>
                <div class="card-body">
                    <p class="card-text">
                        <h5 class="card-title">年級</h5>
                        <h4 class="card-subtitle mb-3"><span class="badge bg-primary">${student["年級"]}</span></h4>
                    </p>
                    <p class="card-text">
                        <h5 class="card-title">課程名稱</h5>
                        <h4 class="card-subtitle mb-2"><span class="badge bg-dark">${student["課程名稱"]}</span></h4>
                    </p>
                    <p class="card-text">
                        <h5 class="card-title">最後一次上課章節</h5>
                        <h4 class="card-subtitle mb-2"><span class="badge bg-secondary">${student["最新課程階段"]}</span></h4>
                    </p>
                    <p class="card-text">
                        <h5 class="card-title">最後一次上課章節完成狀態</h5>
                        <h4 class="card-subtitle mb-2"><span class="badge ${(student["最新完成狀態"] === "完整完成") ? "bg-success" : "bg-danger"}">${student["最新完成狀態"]}</span></h4>
                    </p>
                    <a href="${student["家長資料網址"]}" target="_blank" class="card-link">家長資料網址</a>
                    <a href="${student["課堂紀錄網址"]}" target="_blank" class="card-link">課堂紀錄網址</a>
                </div>
            </div>`;
        }
    }

    // 加入懸浮訊息小視窗 
    function addFloatingMessageWindow() {
        /* 
        加入懸浮訊息小視窗 
        功能： 
        1. 縮圖為圓圈，內帶有 KH 字樣。
        2. 點擊後，會顯示展開一個小視窗，內容為取得的學生名單內容。
        3. 縮小後可任意拖動至畫面任何位置，重新整理畫面後，預設位置於畫面內右上角。
        */
        let floatingMessageWindow = document.createElement("div");
        floatingMessageWindow.classList.add("floating-message-window-shrinked");
        floatingMessageWindow.innerHTML = "KH";
        floatingMessageWindow.title = "點擊展開小視窗\n按住 CTRL + 滑鼠左鍵，便可以將懸浮訊息小視窗任意移動到目前視窗的各位置";
        document.body.appendChild(floatingMessageWindow);
        return floatingMessageWindow;
    }

    // 懸浮訊息小視窗點擊後會展開小視窗的函式
    function showExtendedFloatingMessageWindow() {
        /* 
        懸浮訊息小視窗 
        功能： 
        1. 點選小視窗右上角的「最小化」按鈕，可以縮小小視窗。
        */
        let floatingMessageWindow = document.querySelector(".floating-message-window-shrinked");
        if (!floatingMessageWindow && isExtended) return;
        isExtended = true;
        if (preCircleLeft !== floatingMessageWindow.getBoundingClientRect().left) {
            preCircleLeft = floatingMessageWindow.getBoundingClientRect().left;
            preCircleTop = floatingMessageWindow.getBoundingClientRect().top;
            return;
        }
        floatingMessageWindow.style.left = preCircleLeft - 450 + 'px';
        floatingMessageWindow.classList.remove("floating-message-window-shrinked");
        floatingMessageWindow.classList.add("floating-message-window-extended");
        floatingMessageWindow.title = "";
        floatingMessageWindow.innerHTML = `
        <div class="d-flex justify-content-between align-items-center my-2" style="width: 100%;">
            <div id="floating-message-window-title">可考慮上課學生名單</div>
            <button id="minimize-btn" type="button" class="btn-close" aria-label="Close"></button>
        </div>
        <div class="d-flex justify-content-between align-items-center pt-2 pb-3" style="width: 100%;">
            <button id="updateRawData" class='btn btn-success' title="${TITLEHINT.updateRawData}">更新原始資料</button>
            <button id="downloadData" class='btn btn-outline-dark' title="下載目前選擇的學生資料"><i class="fa-solid fa-download"></i></button>
            <div class="btn-group" role="group" aria-label="Basic radio toggle button group">
                <input type="radio" class="btn-check" name="btnradio" id="buttonAPCS" autocomplete="off" checked>
                <label class="btn btn-outline-primary" for="buttonAPCS" title="${TITLEHINT.APCS}">APCS</label>
    
                <input type="radio" class="btn-check" name="btnradio" id="buttonITSPython" autocomplete="off">
                <label class="btn btn-outline-primary" for="buttonITSPython" title="${TITLEHINT.ITSPython}">ITS Python</label>
    
                <input type="radio" class="btn-check" name="btnradio" id="buttonTQCAPP" autocomplete="off">
                <label class="btn btn-outline-primary" for="buttonTQCAPP" title="${TITLEHINT.TQCAPP}">TQC+ APP</label>
            </div>
        </div>
        <div id="studentList" class="border-bottom border-top"></div>
        `;

        // 懸浮訊息小視窗縮小按鈕點擊事件
        document.querySelector("#minimize-btn")
            .addEventListener("click", closeFloatingMessageWindow, false);

        // 更新 rawData 按鈕點擊事件
        document.querySelector("#updateRawData")
            .addEventListener("click", async () => await processRawData(khStudentListLinks));

        // 下載資料按鈕點擊事件
        document.querySelector("#downloadData")
            .addEventListener("click", () => {
                let chosenStudentList = [], fileName = '';
                if (document.querySelector("#buttonAPCS").checked) {
                    chosenStudentList = allInfo.APCS;
                    fileName = "APCS";
                } else if (document.querySelector("#buttonITSPython").checked) {
                    chosenStudentList = allInfo.ITSPython;
                    fileName = "ITS_Python";
                } else if (document.querySelector("#buttonTQCAPP").checked) {
                    chosenStudentList = allInfo.TQCAPP;
                    fileName = "TQC_APP";
                }
                let code = '';
                for (let student of chosenStudentList) {
                    code += `${student["姓名"]}（${student["年級"]}）- ${student["課程名稱"]} - ${student["最新課程階段"]} - ${student["最新完成狀態"]}\n\t家長資料：${student["家長資料網址"]}\n\t課堂紀錄：${student["課堂紀錄網址"]}\n\n`;
                }
                downloadSourceCode(code, `${fileName}_可考慮上課學生名單_${new Date().toLocaleDateString()}.txt`);
            });

        // APCS 按鈕點擊事件，並帶入 khStudentListLinks 參數
        document.querySelector("#buttonAPCS")
            .addEventListener("click", async () => await processAPCS(khStudentListLinks));

        // ITSPython 按鈕點擊事件，並帶入 khStudentListLinks 參數
        document.querySelector("#buttonITSPython")
            .addEventListener("click", async () => await processITSPython(khStudentListLinks));

        // TQC+ APP 按鈕點擊事件，並帶入 khStudentListLinks 參數
        document.querySelector("#buttonTQCAPP")
            .addEventListener("click", async () => await processTQCAPP(khStudentListLinks));

        // 若正在更新資料，則顯示目前更新進度與 SPINNER
        if (isUpdating) {
            let studentList = document.querySelector("#studentList");
            studentList.innerHTML = studentListLogging + SPINNER;
            document.querySelector("#updateRawData").disabled = true;
            document.querySelector("#downloadData").disabled = true;
            document.querySelector("#buttonAPCS").disabled = true;
            document.querySelector("#buttonITSPython").disabled = true;
            document.querySelector("#buttonTQCAPP").disabled = true;
            return;
        }
        // 顯示 APCS 於 #studentList 中
        showStudentList(allInfo.APCS);
    }

    // 關閉懸浮訊息小視窗的函式
    function closeFloatingMessageWindow() {
        /* 
        關閉懸浮訊息小視窗 
        功能： 
        1. 點選小視窗右上角的「最小化」按鈕，可以縮小小視窗。
        */
        let floatingMessageWindow = document.querySelector(".floating-message-window-extended");
        let floatingMessageWindowRect = floatingMessageWindow.getBoundingClientRect();
        preCircleLeft = floatingMessageWindowRect.left;
        preCircleTop = floatingMessageWindowRect.top;
        isExtended = false;
        floatingMessageWindow.style.left = preCircleLeft + floatingMessageWindowRect.width - 50 + 'px';
        floatingMessageWindow.classList.remove("floating-message-window-extended");
        floatingMessageWindow.classList.add("floating-message-window-shrinked");
        floatingMessageWindow.innerHTML = "KH";
        floatingMessageWindow.title = "點擊展開小視窗\n按住 CTRL + 滑鼠左鍵，便可以將懸浮訊息小視窗任意移動到目前視窗的各位置";
        floatingMessageWindowRect = floatingMessageWindow.getBoundingClientRect();
        preCircleLeft = floatingMessageWindowRect.left;
        preCircleTop = floatingMessageWindowRect.top;
    }

    // 下載原始碼函式，用法：downloadSourceCode("原始碼", "檔案名稱");
    function downloadSourceCode(code, filename) {
        let element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(code));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }

    /* 實驗性功能：按住 Ctrl + 滑鼠，便可以將懸浮訊息小視窗任意移動到目前視窗的各位置 */
    // 初始化變數來追蹤拖動
    let isDragging = false;
    let offsetX, offsetY;

    // 取得圓圈元素
    circle = document.querySelector('.floating-message-window-shrinked');

    // 滑鼠按下事件
    circle.onmousedown = function (e) {
        if (!e.ctrlKey) return;
        isDragging = true;
        preCircleLeft = circle.getBoundingClientRect().left;
        preCircleTop = circle.getBoundingClientRect().top;
        offsetX = e.clientX - preCircleLeft;
        offsetY = e.clientY - preCircleTop;
        circle.classList.add("dragging");
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // 滑鼠移動事件
    function onMouseMove(e) {
        if (!isDragging) return;
        circle.style.left = e.clientX - offsetX + 'px';
        circle.style.top = e.clientY - offsetY + 'px';
    }

    // 滑鼠放開事件
    function onMouseUp() {
        isDragging = false;
        circle.classList.remove("dragging");
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
    /* 實驗性功能結尾 */
})();
