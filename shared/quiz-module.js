const DEFAULT_MESSAGES = {
    questionLabel: (index) => `Q${index}`,
    submitButton: "Submit",
    submittedButton: "Submitted",
    unansweredAlert: (remaining) => `There are ${remaining} unanswered questions.`,
    scoreLabel: (correct, total) => `Score: ${correct} / ${total}`,
    resultMessages: {
        perfect: ["🏆", "Perfect score."],
        great: ["🌟", "Great work."],
        good: ["👍", "Good progress."],
        retry: ["💪", "Keep trying."]
    },
    completedBanner: (score, total) => `Completed. Score: ${score ?? "?"} / ${total}`,
    unauthenticated: "Not signed in."
};

function getElement(target) {
    if (!target) {
        return null;
    }
    if (typeof target === "string") {
        return document.getElementById(target);
    }
    return target;
}

function shuffleArray(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
}

export function initQuizModule({
    questions,
    selectors,
    messages = {},
    loadProgress = null,
    saveProgress = null,
    getCurrentUser = null,
    onRequireLogin = null,
    onAfterSubmit = null
}) {
    const mergedMessages = {
        ...DEFAULT_MESSAGES,
        ...messages,
        resultMessages: {
            ...DEFAULT_MESSAGES.resultMessages,
            ...(messages.resultMessages || {})
        }
    };

    const selectedOptions = {};
    let submitted = false;
    let rendered = false;
    let progressLoaded = false;

    const lockEl = getElement(selectors?.lock);
    const contentEl = getElement(selectors?.content);
    const containerEl = getElement(selectors?.container);
    const statusBannerEl = getElement(selectors?.statusBanner);
    const statusTextEl = getElement(selectors?.statusText);

    function setCompletedState(score) {
        submitted = true;

        if (statusBannerEl) {
            statusBannerEl.classList.remove("hidden");
        }
        if (statusTextEl) {
            statusTextEl.textContent = mergedMessages.completedBanner(score, questions.length);
        }

        document.querySelectorAll("#quiz-container .opt-btn").forEach((button) => {
            button.disabled = true;
            button.classList.add("opacity-60", "cursor-not-allowed");
        });

        const submitButton = document.getElementById("quiz-submit-btn");
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.classList.add("opacity-50", "cursor-not-allowed");
            submitButton.textContent = mergedMessages.submittedButton;
        }
    }

    async function hydrateProgress() {
        if (typeof loadProgress !== "function") {
            return;
        }

        const progress = await loadProgress();
        if (progress?.completed) {
            setCompletedState(progress.score);
        }
    }

    function render() {
        if (rendered || !containerEl) {
            return;
        }

        rendered = true;
        const shuffledQuestions = shuffleArray(questions);
        let html = "";

        shuffledQuestions.forEach((question, index) => {
            const shuffledOptions = shuffleArray(question.options);
            const optionsHtml = shuffledOptions
                .map((option) => `
                    <button
                        type="button"
                        class="opt-btn text-left p-4 rounded-xl border-2 border-gray-200 bg-white font-bold text-gray-700 hover:border-rose-400 hover:bg-rose-50"
                        data-qid="${question.id}"
                        data-correct="${option.correct}"
                        onclick="selectOption(${question.id}, this)"
                    >${option.text}</button>
                `)
                .join("");

            html += `
                <div class="bg-gray-50 border-2 border-gray-200 rounded-2xl p-5">
                    <p class="font-black text-gray-800 text-lg mb-4">
                        <span class="bg-rose-100 text-rose-600 px-2 py-0.5 rounded mr-2">${mergedMessages.questionLabel(index + 1)}</span>${question.questionHtml}
                    </p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="opts-${question.id}">
                        ${optionsHtml}
                    </div>
                </div>
            `;
        });

        html += `
            <div class="text-center mt-8">
                <button
                    type="button"
                    id="quiz-submit-btn"
                    onclick="submitQuiz()"
                    class="bg-rose-500 hover:bg-rose-600 text-white font-black text-xl py-4 px-12 rounded-2xl shadow-lg transition transform hover:scale-105 active:scale-95"
                >
                    ${mergedMessages.submitButton}
                </button>
            </div>
            <div id="quiz-result" class="hidden bg-rose-50 border-4 border-rose-300 rounded-2xl p-8 text-center mt-6">
                <div id="quiz-result-emoji" class="text-6xl mb-4"></div>
                <div id="quiz-result-score" class="text-4xl font-black text-rose-700 mb-3"></div>
                <div id="quiz-result-msg" class="text-xl font-bold text-gray-700"></div>
            </div>
        `;

        containerEl.innerHTML = html;
    }

    function selectOption(questionId, buttonEl) {
        if (submitted) {
            return;
        }

        selectedOptions[questionId] = buttonEl;
        document.getElementById(`opts-${questionId}`)?.querySelectorAll(".opt-btn").forEach((button) => {
            button.classList.remove("selected");
        });
        buttonEl.classList.add("selected");
    }

    async function submit() {
        if (submitted) {
            return;
        }

        const total = questions.length;
        const answered = Object.keys(selectedOptions).length;

        if (answered < total) {
            window.alert(mergedMessages.unansweredAlert(total - answered));
            return;
        }

        submitted = true;
        let correct = 0;

        questions.forEach((question) => {
            const optionsEl = document.getElementById(`opts-${question.id}`);
            if (!optionsEl) {
                return;
            }

            optionsEl.querySelectorAll(".opt-btn").forEach((button) => {
                button.classList.remove("selected");
                button.disabled = true;
                if (button.dataset.correct === "true") {
                    button.classList.add("correct");
                } else if (button === selectedOptions[question.id]) {
                    button.classList.add("wrong");
                }
            });

            if (selectedOptions[question.id]?.dataset.correct === "true") {
                correct += 1;
            }
        });

        const resultEl = document.getElementById("quiz-result");
        resultEl?.classList.remove("hidden");

        const scoreEl = document.getElementById("quiz-result-score");
        const emojiEl = document.getElementById("quiz-result-emoji");
        const msgEl = document.getElementById("quiz-result-msg");

        const bucket = correct === total
            ? mergedMessages.resultMessages.perfect
            : correct >= total - 1
                ? mergedMessages.resultMessages.great
                : correct >= Math.ceil(total / 2)
                    ? mergedMessages.resultMessages.good
                    : mergedMessages.resultMessages.retry;

        if (scoreEl) {
            scoreEl.textContent = mergedMessages.scoreLabel(correct, total);
        }
        if (emojiEl) {
            emojiEl.textContent = bucket[0];
        }
        if (msgEl) {
            msgEl.textContent = bucket[1];
        }

        const submitButton = document.getElementById("quiz-submit-btn");
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.classList.add("opacity-50", "cursor-not-allowed");
        }

        const user = typeof getCurrentUser === "function"
            ? await getCurrentUser()
            : null;

        if (!user && typeof onRequireLogin === "function") {
            await onRequireLogin();
        } else if (user && typeof saveProgress === "function") {
            await saveProgress(correct);
        }

        if (typeof onAfterSubmit === "function") {
            await onAfterSubmit({ correct, total });
        }
    }

    async function handleAuthChange(session) {
        if (session?.user) {
            lockEl?.classList.add("hidden");
            contentEl?.classList.remove("hidden");
            render();
            if (!progressLoaded) {
                await hydrateProgress();
                progressLoaded = true;
            }
            return;
        }

        progressLoaded = false;
        lockEl?.classList.remove("hidden");
        contentEl?.classList.add("hidden");
        if (statusTextEl) {
            statusTextEl.textContent = mergedMessages.unauthenticated;
        }
    }

    return {
        handleAuthChange,
        render,
        selectOption,
        submit,
        showCompletedState: setCompletedState
    };
}
