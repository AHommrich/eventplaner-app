import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { API_BASE } from '../constants/env';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('guest_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let _blocked = false;
let _drinksBlocked = false;
let _drinksBlockedHandler: (() => void) | null = null;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.code;
    if (error.response?.status === 403 && code === 'app_blocked') {
      if (!_blocked) {
        _blocked = true;
        router.replace('/blocked');
      }
      return new Promise(() => {}); // schlucken — kein catch/Alert feuert
    }
    if (code === 'drinks_blocked') {
      if (!_drinksBlocked) {
        _drinksBlocked = true;
        _drinksBlockedHandler?.();
      }
      return new Promise(() => {}); // schlucken
    }
    return Promise.reject(error);
  }
);

export function clearBlocked() {
  _blocked = false;
}

export function registerDrinksBlockedHandler(fn: () => void) {
  _drinksBlockedHandler = fn;
}

export function clearDrinksBlockedHandler() {
  _drinksBlockedHandler = null;
  _drinksBlocked = false;
}

export function resetDrinksBlocked() {
  _drinksBlocked = false;
}

export default api;
