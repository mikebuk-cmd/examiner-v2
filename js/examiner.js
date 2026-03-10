/**
 * @brief Перевірка, чи підтримується формат DLC (JSON-файлу з тестами)
 * * @param {*} questions Завантажений об'єкт з файлу
 * @returns false, якщо структура не підтримується
 */
function VerifyDlc(questions) {
    // Examiner-v2 очікує дані в полі "data"
    if (questions["data"] == undefined) {
        showEndscreen("Error", "Could not find 'data' key in DLC file :(");
        return false;
    }

    if (questions["data"].length == 0) {
        showEndscreen("Error", "No questions found in DLC file :(");
        return false;
    }

    // Перевірка версії ( "version": "1.0" у JSON)
    if (!supportedVersions.includes(questions["version"])) {
        showEndscreen("Error", "Unsupported DLC version :(<br><br>Check supported versions in releases.");
        return false;
    }

    // Перевірка наявності типу для кожного питання
    for (let i = 0; i < questions["data"].length; i++) {
        var qtype = questions["data"][i]["type"];
        if (qtype == undefined) {
            showEndscreen("Error", "Missing 'type' in question ID " + (questions["data"][i]["id"] || i) + " :(");
            return false;
        }
        if (!supportedQuestionTypes.includes(qtype)) {
            showEndscreen("Error", "Unsupported question type: " + qtype);
            return false;
        }
    }

    return true;
}

/**
 * @brief Функція відправки результатів у Google Sheets
 */
const submitToGoogleSheets = async (candidateName, examinerInstance) => {
    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz58wcwvXl-K4L-wo2Bub0ec0aMlbO1MBKQ1FXjCk86BxmNZGthk6ytn15KUfMfM-FgVg/exec"; 
    
    const payload = {
        token: "MySecretKey", //  секретний ключ для доступу
        name: candidateName,
        testTitle: examinerInstance.title || "Technical Test",
        score: examinerInstance.score || 0,
        percent: Math.round(((examinerInstance.score || 0) / examinerInstance.questions.length) * 100),
        details: examinerInstance.questions.map(q => ({
            question: q.question,
            userAnswer: q.userAnswer || "Немає відповіді",
            correctAnswer: q.answer
        }))
    };

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Обов'язково для Google Apps Script
            cache: 'no-cache',
            body: JSON.stringify(payload)
        });
        console.log("Результати успішно надіслано до Google Sheets");
    } catch (error) {
        console.error("Помилка при відправці даних:", error);
    }
};

class QuestionPool {
    constructor(size) {
        this.questions = [];
        this.size = size;
        this.currentQuestion = 0;
        this.previousQuestion = 0;
    }

    AddQuestion(question) {
        this.questions.push(question);
    }

    get IsFull() {
        return this.questions.length >= this.size;
    }

    get IsEmpty() {
        return this.questions.length == 0;
    }

    GetRandomQuestion() {
        do {
            this.currentQuestion = Math.floor(Math.random() * this.questions.length);
        } while (this.currentQuestion == this.previousQuestion && this.questions.length > 1);

        this.previousQuestion = this.currentQuestion;
        return this.questions[this.currentQuestion];
    }

    RemoveCurrentQuestion() {
        this.questions.splice(this.currentQuestion, 1);
    }
}

class Examiner {
    constructor(questions, title = "Technical Test", poolsize = 5) {
        this.title = title;
        this.questions = shuffle(questions); // Масив усіх питань
        this.questionIndex = 0;
        this.score = 0; // Набрані бали
        this.end = false;
        this.questionPool = new QuestionPool(poolsize);
        this.startTime = new Date();

        this.InitUI();
        this.FillQuestionPool();
    }

    InitUI() {
        let qListElement = document.getElementById('questionList');
        if (qListElement) {
            qListElement.innerHTML = ''; 
            this.questions.forEach((question, key) => {
                let qElement = document.createElement('div');
                qElement.innerText = key + 1;
                qElement.id = 'question-list-item-' + (question.id || key);
                qListElement.appendChild(qElement);
            });
        }
    }

    /**
     * @brief Завершення тесту та ініціація відправки даних
     */
    Finish(candidateName) {
        if (!candidateName) {
            candidateName = "Anonymous_Candidate";
        }
        submitToGoogleSheets(candidateName, this);
    }

    GetQuestion() {
        if (!this.questionPool.IsFull) {
            this.FillQuestionPool();
        }
        return this.questionPool.GetRandomQuestion();
    }

    RemoveCurrentQuestion() {
        this.questionPool.RemoveCurrentQuestion();
    }

    get IsEnd() {
        return this.end && this.questionPool.IsEmpty;
    }

    get GetQuestionCount() {
        return this.questions.length - this.questionIndex + this.questionPool.questions.length;
    }

    FillQuestionPool() {
        while (!this.questionPool.IsFull && this.questionIndex < this.questions.length) {
            var question = this.questions[this.questionIndex];
            this.questionIndex++;
            this.questionPool.AddQuestion(question);
        }
        if (this.questionIndex >= this.questions.length) {
            this.end = true;
        }
    }
}
