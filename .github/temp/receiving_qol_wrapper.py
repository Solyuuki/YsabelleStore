from pathlib import Path

source = Path(".github/workflows/temp-receiving-qol.yml").read_text()
start = source.index("python3 <<'PY'\n") + len("python3 <<'PY'\n")
end = source.rindex("\n          PY")
block = source[start:end]
lines = [line[10:] if line.startswith("          ") else line for line in block.splitlines()]
script = "\n".join(lines) + "\n"

old_func = '''def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)'''
smart_func = '''def replace_once(text, old, new, label):
    count = text.count(old)
    if count == 1:
        return text.replace(old, new, 1)
    if label == "receiving pagination component":
        start_marker = "        {visibleTotal > visibleOrders.length ? ("
        end_marker = "        ) : null}"
        start = text.index(start_marker)
        end = text.index(end_marker, start) + len(end_marker)
        return text[:start] + new.rstrip("\\n") + text[end:]
    raise SystemExit(f"{label}: expected exactly one match, found {count}")'''
if old_func not in script:
    raise SystemExit("replace_once helper hook not found")
script = script.replace(old_func, smart_func, 1)

brittle = 'text = replace_once(text, old_load, new_load, "receiving loader")'
resilient = '''loader_start = text.index("  const loadQueue = useCallback(async () => {")
loader_end = text.index("\\n\\n  useEffect(() => {", loader_start)
text = text[:loader_start] + new_load.rstrip("\\n") + text[loader_end:]'''
if brittle not in script:
    raise SystemExit("receiving loader replacement hook not found")
script = script.replace(brittle, resilient, 1)

compiled = compile(script, "/tmp/receiving-qol.py", "exec")
exec(compiled, {"__name__": "__main__"})
