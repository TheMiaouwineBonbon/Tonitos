const ACCOUNT_STORAGE_KEY = "spellaho-accounts-v1";
const ACTIVE_ACCOUNT_KEY = "spellaho-active-account-v1";
const MAX_LEVEL = 50;

export const GRADE_DEFINITIONS = [
  { id: "debutant", name: "Débutant", minLevel: 1, image: "Images/Grade/Niveau Débutant.png" },
  { id: "bronze", name: "Bronze", minLevel: 2, image: "Images/Grade/Niveau Bronze.png" },
  { id: "silver", name: "Silver", minLevel: 4, image: "Images/Grade/Niveau Silver.png" },
  { id: "or", name: "Or", minLevel: 6, image: "Images/Grade/Niveau Or.png" },
  { id: "platine", name: "Platine", minLevel: 8, image: "Images/Grade/Niveau Platine.png" },
  { id: "diamant", name: "Diamant", minLevel: 10, image: "Images/Grade/Niveau Diamant.png" },
  { id: "emeraude", name: "Émeraude", minLevel: 13, image: "Images/Grade/Niveau Emeraude.png" },
  { id: "master", name: "Master", minLevel: 16, image: "Images/Grade/Niveau Master.png" }
];

export const XP_REWARDS = {
  win: 100,
  loss: 35,
  draw: 60
};

function storage() {
  return globalThis.localStorage || null;
}

function normalizeAccount(account = {}) {
  const xp = Math.max(0, Number(account.xp) || 0);
  const progression = getLevelProgress(xp);
  return {
    id: String(account.id || crypto.randomUUID()),
    name: String(account.name || "Joueur").trim().slice(0, 24) || "Joueur",
    avatar: String(account.avatar || ""),
    xp,
    level: progression.level,
    wins: Math.max(0, Number(account.wins) || 0),
    losses: Math.max(0, Number(account.losses) || 0),
    draws: Math.max(0, Number(account.draws) || 0),
    matches: Math.max(0, Number(account.matches) || 0),
    rewardedMatches: Array.isArray(account.rewardedMatches)
      ? account.rewardedMatches.map(String).slice(-50)
      : [],
    createdAt: Number(account.createdAt) || Date.now(),
    updatedAt: Number(account.updatedAt) || Date.now()
  };
}

export function xpNeededForLevel(level) {
  return 100 + Math.max(0, level - 1) * 60;
}

export function getLevelProgress(totalXp = 0) {
  let level = 1;
  let remaining = Math.max(0, Number(totalXp) || 0);
  while (level < MAX_LEVEL) {
    const needed = xpNeededForLevel(level);
    if (remaining < needed) break;
    remaining -= needed;
    level += 1;
  }
  const nextXp = level >= MAX_LEVEL ? 0 : xpNeededForLevel(level);
  return {
    level,
    currentXp: level >= MAX_LEVEL ? 0 : remaining,
    nextXp,
    percent: level >= MAX_LEVEL ? 100 : Math.round((remaining / nextXp) * 100)
  };
}

export function getGrade(level = 1) {
  return [...GRADE_DEFINITIONS]
    .reverse()
    .find((grade) => level >= grade.minLevel) || GRADE_DEFINITIONS[0];
}

export function loadAccounts() {
  const store = storage();
  if (!store) return [];
  try {
    const value = JSON.parse(store.getItem(ACCOUNT_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value.map(normalizeAccount) : [];
  } catch {
    return [];
  }
}

export function saveAccounts(accounts) {
  const normalized = accounts.map(normalizeAccount);
  storage()?.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function getAccount(id) {
  return loadAccounts().find((account) => account.id === id) || null;
}

export function getActiveAccountId() {
  return storage()?.getItem(ACTIVE_ACCOUNT_KEY) || "";
}

export function setActiveAccountId(id) {
  if (!storage()) return;
  if (id) storage().setItem(ACTIVE_ACCOUNT_KEY, id);
  else storage().removeItem(ACTIVE_ACCOUNT_KEY);
}

export function createAccount({ name, avatar }) {
  const account = normalizeAccount({
    id: crypto.randomUUID(),
    name,
    avatar,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  saveAccounts([...loadAccounts(), account]);
  setActiveAccountId(account.id);
  return account;
}

export function updateAccount(id, patch = {}) {
  let updated = null;
  const accounts = loadAccounts().map((account) => {
    if (account.id !== id) return account;
    updated = normalizeAccount({ ...account, ...patch, id, updatedAt: Date.now() });
    return updated;
  });
  saveAccounts(accounts);
  return updated;
}

export function awardAccount(id, result, matchId = "") {
  const account = getAccount(id);
  if (!account || !XP_REWARDS[result]) return null;
  if (matchId && account.rewardedMatches.includes(matchId)) return null;

  const previousLevel = account.level;
  const previousGrade = getGrade(previousLevel);
  const patch = {
    xp: account.xp + XP_REWARDS[result],
    wins: account.wins + (result === "win" ? 1 : 0),
    losses: account.losses + (result === "loss" ? 1 : 0),
    draws: account.draws + (result === "draw" ? 1 : 0),
    matches: account.matches + 1,
    rewardedMatches: matchId
      ? [...account.rewardedMatches, matchId].slice(-50)
      : account.rewardedMatches
  };
  const updated = updateAccount(id, patch);
  const grade = getGrade(updated.level);
  return {
    account: updated,
    xpEarned: XP_REWARDS[result],
    result,
    leveledUp: updated.level > previousLevel,
    gradeChanged: grade.id !== previousGrade.id,
    grade,
    progress: getLevelProgress(updated.xp)
  };
}
