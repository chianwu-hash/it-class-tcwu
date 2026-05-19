function applySlot(element, slot, index) {
    element.style.setProperty("--x", `${slot.x}%`);
    element.style.setProperty("--y", `${slot.y}%`);
    element.style.setProperty("--size", `${slot.s}px`);
    element.style.setProperty("--rot", `${slot.r}deg`);
    element.style.setProperty("--i", index);
}

function createLeafElement(reward, slot, index, onSelect, ghost = false) {
    const leaf = ghost && reward?.href
        ? document.createElement("a")
        : document.createElement("button");
    if (leaf.tagName === "BUTTON") {
        leaf.type = "button";
    } else {
        leaf.href = reward.href;
    }
    leaf.className = [
        "reward",
        "leaf",
        reward?.kind === "quiz-leaf" ? "quiz" : "",
        ghost ? "ghost" : ""
    ].filter(Boolean).join(" ");
    leaf.dataset.rewardKind = reward?.kind || "ghost-leaf";
    leaf.setAttribute("aria-label", ghost ? reward?.title || "尚未取得的葉子位置" : reward.title);
    leaf.title = ghost && reward?.href ? "前往挑戰" : reward?.title || "";
    applySlot(leaf, slot, index);

    if (!ghost) {
        leaf.addEventListener("click", () => onSelect(reward));
    }

    return leaf;
}

function createFlowerElement(reward, slot, index, onSelect, ghost = false) {
    const flower = ghost && reward?.href
        ? document.createElement("a")
        : document.createElement("button");
    if (flower.tagName === "BUTTON") {
        flower.type = "button";
    } else {
        flower.href = reward.href;
    }
    flower.className = ["reward", "flower", ghost ? "ghost" : ""].filter(Boolean).join(" ");
    flower.dataset.rewardKind = reward?.kind || "ghost-flower";
    flower.setAttribute("aria-label", ghost ? reward?.title || "尚未取得的花朵位置" : reward.title);
    flower.title = ghost && reward?.href ? "前往魔王關" : reward?.title || "";
    applySlot(flower, slot, index);

    if (!ghost) {
        flower.addEventListener("click", () => onSelect(reward));
    }

    return flower;
}

export function renderRewardTree({
    layer,
    leaves,
    flowers,
    pendingLeaves = [],
    pendingFlowers = [],
    leafSlots,
    flowerSlots,
    onSelect,
    ghostLeafCount = 8,
    ghostFlowerCount = 2
}) {
    if (!layer) {
        return;
    }

    layer.innerHTML = "";
    const selectHandler = typeof onSelect === "function" ? onSelect : () => {};

    let rewardIndex = 0;
    const earnedLeaves = leaves.slice(0, leafSlots.length);
    const earnedFlowers = flowers.slice(0, flowerSlots.length);

    earnedLeaves.forEach((reward) => {
        const slot = leafSlots[rewardIndex];
        if (slot) {
            layer.appendChild(createLeafElement(reward, slot, rewardIndex, selectHandler));
            rewardIndex += 1;
        }
    });

    const firstGhostLeafSlot = earnedLeaves.length;
    pendingLeaves.slice(0, ghostLeafCount).forEach((reward, index) => {
        const slot = leafSlots[firstGhostLeafSlot + index];
        if (slot) {
            layer.appendChild(createLeafElement(reward, slot, rewardIndex, selectHandler, true));
            rewardIndex += 1;
        }
    });

    earnedFlowers.forEach((reward, index) => {
        const slot = flowerSlots[index];
        if (slot) {
            layer.appendChild(createFlowerElement(reward, slot, rewardIndex, selectHandler));
            rewardIndex += 1;
        }
    });

    const firstGhostFlowerSlot = earnedFlowers.length;
    pendingFlowers.slice(0, ghostFlowerCount).forEach((reward, index) => {
        const slot = flowerSlots[firstGhostFlowerSlot + index];
        if (slot) {
            layer.appendChild(createFlowerElement(reward, slot, rewardIndex, selectHandler, true));
            rewardIndex += 1;
        }
    });
}

export function selectReward(reward, titleEl, textEl) {
    if (!reward || !titleEl || !textEl) {
        return;
    }

    titleEl.textContent = reward.title;
    const when = reward.updatedAtText ? `最後更新：${reward.updatedAtText}` : "尚無更新時間";
    textEl.textContent = `${reward.reason} ${reward.detail} ${when}`;
}
