"use client";

import { useSyncExternalStore } from "react";

import type { SafeChallenge } from "@/lib/auth-flow-tickets";

const challengeStorageKey = "app-nexo-auth-challenge";
const listeners = new Set<() => void>();
let cachedRawValue: string | null | undefined;
let cachedChallenge: StoredChallengeState | null = null;

export type StoredChallengeState = {
  challenge: SafeChallenge;
  challengeTicket: string;
  email: string;
};

function isStoredChallengeState(value: unknown): value is StoredChallengeState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredChallengeState>;

  return (
    typeof candidate.challengeTicket === "string" &&
    candidate.challengeTicket.length > 0 &&
    typeof candidate.email === "string" &&
    typeof candidate.challenge?.challengeName === "string" &&
    Array.isArray(candidate.challenge.availableChallenges) &&
    Array.isArray(candidate.challenge.requiredAttributes)
  );
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function readStoredChallenge() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(challengeStorageKey);

  if (raw === cachedRawValue) {
    return cachedChallenge;
  }

  cachedRawValue = raw;

  if (!raw) {
    cachedChallenge = null;
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    cachedChallenge = isStoredChallengeState(parsed) ? parsed : null;
  } catch {
    cachedChallenge = null;
  }

  return cachedChallenge;
}

export function writeStoredChallenge(value: StoredChallengeState) {
  const serialized = JSON.stringify(value);
  window.sessionStorage.setItem(challengeStorageKey, serialized);
  cachedRawValue = serialized;
  cachedChallenge = value;
  emitChange();
}

export function clearStoredChallenge() {
  window.sessionStorage.removeItem(challengeStorageKey);
  cachedRawValue = null;
  cachedChallenge = null;
  emitChange();
}

export function subscribeStoredChallenge(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function useStoredChallenge() {
  return useSyncExternalStore(subscribeStoredChallenge, readStoredChallenge, () => null);
}
