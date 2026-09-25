<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let initialValue = "";
  export let inputProps = {};
  export let searchAsYouType = false; // 改为默认不即时搜索
  export let debounceLength = 200;
  
  const dispatch = createEventDispatcher();
  
  let searchTerm = initialValue;
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  
  function handleChange(e: Event) {
    const newValue = (e.target as HTMLInputElement).value;
    searchTerm = newValue;
    
    if (debounceTimeout) clearTimeout(debounceTimeout);
    
    // 如果开启了即时搜索，添加防抖
    if (searchAsYouType) {
      debounceTimeout = setTimeout(() => {
        dispatch('change', { value: newValue });
      }, debounceLength);
    }
  }
  
  function handleSubmit(e: Event) {
    e.preventDefault();
    dispatch('submit', { value: searchTerm });
  }
  
  function handleClear() {
    searchTerm = "";
    dispatch('change', { value: "" });
    dispatch('clear');
  }
</script>

<style>
  .sui-search-box {
    position: relative;
    flex-grow: 1;
  }
  
  .sui-search-box__container {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.25rem;
  }

  .sui-search-box__text-input {
    width: 100%;
    padding: 0.5rem 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.25rem;
    background-color: white;
    color: #000;
  }

  .sui-search-box__text-input:focus {
    outline: none;
    ring: 1px solid #3b82f6;
  }

  :global(.dark) .sui-search-box__text-input {
    background-color: #1E1E1E;
    color: white;
    border-color: #374151;
  }

  .sui-search-box__submit {
    padding: 0.5rem 1rem;
    left: calc(100% - 69px);
    background-color: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.3rem;
    cursor: pointer;
  }

  .sui-search-box__submit:hover {
    background-color: #2563eb;
  }
</style>

<form class="sui-search-box" on:submit={handleSubmit} {...$$restProps}>
  <div class="sui-search-box__container">
    <input
      class="sui-search-box__text-input"
      type="text"
      bind:value={searchTerm}
      on:input={handleChange}
      placeholder="搜索专利关键词..."
      aria-label="Search"
      {...inputProps}
    />
    
    <button
      class="sui-search-box__submit"
      type="submit"
      aria-label="Submit"
    >
      搜索
    </button>
  </div>
</form>