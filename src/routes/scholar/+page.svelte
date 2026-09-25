<script>
  import ScholarOverlay from "$lib/components/chat/homepage/ScholarOverlay.svelte";

  // 不是 SvelteKit！手动从窗口读取 URL
  const url = new URL(window.location.href);
  const authorName = url.searchParams.get("name") || "";
</script>

<ScholarOverlay
  authorName={authorName}
  authorId=""
  count={0}
  papers={[]}
/>

