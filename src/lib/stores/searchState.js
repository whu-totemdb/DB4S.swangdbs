// src/lib/stores/searchState.js
import { writable } from 'svelte/store';

export const savedSearchState = writable({
  searchTerm: "",
  filters: [],
  currentPage: 1,
  sorting: null,
  hasSearched: false
});