// حجب ظهور أي رقم في واجهة التطبيق لدور "مشاهد" (viewer)
// يغطي كل النصوص المعروضة: الجداول، الإحصائيات، التواريخ، الأسعار، أرقام الفواتير والهواتف...
// لا يلمس حقول الإدخال (input/textarea) حتى تظل أدوات الفلترة والبحث تعمل بشكل طبيعي.

const DIGITS = /[0-9\u0660-\u0669]+/g;
const HAS_DIGIT = /[0-9\u0660-\u0669]/;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "INPUT", "TEXTAREA"]);

function maskTextNode(node) {
  if (HAS_DIGIT.test(node.data)) {
    node.data = node.data.replace(DIGITS, (run) => "•".repeat(run.length));
  }
}

function maskSubtree(root) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    if (!root.parentElement || !SKIP_TAGS.has(root.parentElement.tagName)) {
      maskTextNode(root);
    }
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE || SKIP_TAGS.has(root.tagName)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      !n.parentElement || SKIP_TAGS.has(n.parentElement.tagName) || !HAS_DIGIT.test(n.data)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  while (walker.nextNode()) maskTextNode(walker.currentNode);
}

let observer = null;

export function startNumberMasking() {
  if (observer || !document.body) return;
  maskSubtree(document.body);
  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "characterData") maskTextNode(m.target);
      else for (const n of m.addedNodes) maskSubtree(n);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

export function stopNumberMasking() {
  if (!observer) return;
  observer.disconnect();
  observer = null;
}