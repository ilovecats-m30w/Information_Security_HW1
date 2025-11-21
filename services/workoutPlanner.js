const Exercise = require('../models/Exercise');

/**
 * 從陣列中隨機取出最多 n 個元素
 */
function pickRandom(arr, n) {
    if (!arr || arr.length === 0) return [];
    const shuffled = arr.slice().sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(n, arr.length));
}

/**
 * 根據活動係數 roughly 決定難度
 */
function inferDifficulty(activityLevel = 1.2) {
    if (activityLevel <= 1.3) return 'beginner';
    if (activityLevel <= 1.6) return 'intermediate';
    return 'advanced';
}

/**
 * 產生今日的運動計畫
 * @param {Object} params
 *  - user: User document
 *  - profile: Profile document
 *  - goal: Goal document (可為 null)
 *  - indoorOnly: boolean (可選)
 */
async function generateWorkoutPlan({ user, profile, goal, indoorOnly = true }) {
    const goalType = goal?.type || 'maintain';
    const difficulty = inferDifficulty(profile?.activityLevel || 1.2);

    const baseQuery = { difficulty };
    if (indoorOnly) {
        baseQuery.isIndoor = true;
    }

    // 先抓出不同類型的運動
    const [strengthList, cardioList, coreList] = await Promise.all([
        Exercise.find({ ...baseQuery, type: 'strength' }),
        Exercise.find({ ...baseQuery, type: 'cardio' }),
        Exercise.find({ ...baseQuery, muscleGroup: 'core' })
    ]);

    // 保底：如果某一類沒有資料，就不要讓程式當掉
    const strength = strengthList || [];
    const cardio   = cardioList   || [];
    const core     = coreList     || [];

    let selected = [];

    if (goalType === 'lose_weight') {
        // 減脂：偏多有氧 + 幾個全身/腿部力量
        const s = pickRandom(strength, 3); // 3 個力量
        const c = pickRandom(cardio, 2);   // 2 個有氧
        selected = [...c, ...s];
    } else if (goalType === 'gain_muscle') {
        // 增肌：多一點力量，區分不同肌群的力量訓練由你在 DB 裡控制
        const s = pickRandom(strength, 5);
        const c = pickRandom(cardio, 1);   // 少量有氧
        selected = [...s, ...c];
    } else {
        // 維持：力量 + 有氧 均衡
        const s = pickRandom(strength, 3);
        const c = pickRandom(cardio, 1);
        selected = [...s, ...c];
    }

    // 如果完全沒選到（DB 可能還空空），就回傳空陣列，避免 500 error
    if (!selected.length) {
        return {
            items: [],
            note: '目前運動庫中資料不足，請先由管理員新增一些 Exercise 資料。'
        };
    }

    // 整理輸出格式：填入 sets/reps/duration
    const planItems = selected.map(ex => {
        const isTimeBased = ex.defaultDuration && ex.defaultDuration > 0;

        return {
            exerciseId: ex._id,
            name: ex.name,
            muscleGroup: ex.muscleGroup,
            type: ex.type,
            difficulty: ex.difficulty,
            equipment: ex.equipment,
            isIndoor: ex.isIndoor,
            demoUrl: ex.demoUrl,
            description: ex.description,
            prescription: isTimeBased
                ? {
                    // 例如：3 組，每組 30 秒
                    sets: ex.defaultSets || 3,
                    durationSeconds: ex.defaultDuration
                }
                : {
                    sets: ex.defaultSets || 3,
                    reps: ex.defaultReps || 12
                }
        };
    });

    return {
        items: planItems,
        note: null
    };
}

module.exports = {
    generateWorkoutPlan
};
