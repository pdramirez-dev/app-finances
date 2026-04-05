"use client";

import { useSyncExternalStore } from "react";

import type { SafeChallenge } from "@/lib/auth-flow-tickets";

const challengeStorageKey = "app-finances-auth-challenge";
const listeners = new Set<() => void>();

export type StoredChallengeState = {
  challenge: SafeChallenge;
  challengeTicket: string;
  email: string;
};

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

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredChallengeState;
  } catch {
    return null;
  }
}

export function writeStoredChallenge(value: StoredChallengeState) {
  window.sessionStorage.setItem(challengeStorageKey, JSON.stringify(value));
  emitChange();
}

export function clearStoredChallenge() {
  window.sessionStorage.removeItem(challengeStorageKey);
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
