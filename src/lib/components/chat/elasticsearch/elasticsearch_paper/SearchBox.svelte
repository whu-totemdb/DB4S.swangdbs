<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let initialValue: string = "";
  export let searchAsYouType: boolean = false;
  export let inputProps: Record<string, any> = {};
  export let placeholder: string = "搜索论文、作者、主题...";
  export let debounceLength = 200;
  
  let searchTerm: string = initialValue;
  let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
  
  const dispatch = createEventDispatcher();
  
  function handleChange(e: Event) {
    const newValue = (e.target as HTMLInputElement).value;
    searchTerm = newValue;
    
    if (debounceTimeout) clearTimeout(debounceTimeout);
    
    if (searchAsYouType) {
      debounceTimeout = setTimeout(() => {
        dispatch('change', { value: newValue });
      }, debounceLength);
    } else {
      dispatch('change', { value: newValue });
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

  :global(.sui-search--dark) .sui-search-box__text-input {
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
      placeholder={placeholder}
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