import { useState, useEffect, useCallback, useRef } from "react";
import {
  ConfigProvider,
  Menu,
  Button,
  Input,
  Table,
  Modal,
  Form,
  Space,
  message,
  Tag,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { listen } from "@tauri-apps/api/event";
import {
  PlusOutlined,
  InboxOutlined,
  ExperimentOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  FileZipOutlined,
  FileImageOutlined,
  AudioOutlined,
  VideoCameraOutlined,
  FileOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import type { Entry, CompressParam, CompressInfo, DecompressInfo } from "./types";
import * as cmd from "./commands";
import { CompressModal } from "./CompressModal";
import { SettingsModal } from "./SettingsModal";

// Tauri adds `path` to File objects
declare global {
  interface File {
    path?: string;
  }
}

// ── helpers ──────────────────────────────────────────────────
const isInCompress = (p: string) => p.includes("!");

const ARCHIVE_EXT_RE = /\.(zip|7z|rar|tar|gz|bz2|xz|tgz|tbz2|tar\.gz|tar\.bz2|tar\.xz)$/i;
const EXTERNAL_OPEN_EVENT = "external-opened";

/** Returns the archive file path if `p` points to an archive or its content, else null. */
const archivePathOf = (p: string): string | null => {
  if (!p) return null;
  if (p.includes("!")) return p.split("!")[0];
  if (ARCHIVE_EXT_RE.test(p)) return p;
  return null;
};

/** True when an error likely indicates wrong/missing password. */
const isPasswordError = (err: unknown): boolean => {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return /password|passphrase|密码|decrypt|encrypted|wrong\s*password/.test(msg);
};

const entryIcon = (t: Entry["type"]): React.ReactNode => {
  const m: Record<string, React.ReactNode> = {
    dir: <FolderOutlined style={{ color: "#faad14" }} />,
    compress: <FileZipOutlined style={{ color: "#fa8c16" }} />,
    image: <FileImageOutlined style={{ color: "#52c41a" }} />,
    audio: <AudioOutlined style={{ color: "#722ed1" }} />,
    video: <VideoCameraOutlined style={{ color: "#1890ff" }} />,
    other: <FileOutlined />,
  };
  return m[t] ?? <FileOutlined />;
};

const fmtSize = (b: number): string => {
  if (b === 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(b) / Math.log(1024)), u.length - 1);
  return `${(b / 1024 ** i).toFixed(i > 0 ? 2 : 0)} ${u[i]}`;
};

const fmtTime = (ts: number): string =>
    ts ? new Date(ts * 1000).toLocaleString("zh-CN", { hour12: false }) : "-";

const fmtCost = (ms: number): string => {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
};

// ── App ──────────────────────────────────────────────────────
function App() {
  // state
  const [currentPath, setCurrentPath] = useState("");
  const [addressValue, setAddressValue] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [initErr, setInitErr] = useState("");
  void initErr;
  const [recentPaths, setRecentPaths] = useState<string[]>([]);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isMac =
      typeof navigator !== "undefined" &&
      (navigator.userAgent.includes("Mac") || navigator.platform?.includes("Mac"));
  const isWindows =
      typeof navigator !== "undefined" &&
      (navigator.userAgent.includes("Windows") || navigator.platform?.includes("Win"));
  const isLinux =
      typeof navigator !== "undefined" &&
      (navigator.userAgent.includes("Linux") || navigator.platform?.includes("Linux"));

  // modal state
  const [compressModal, setCompressModal] = useState(false);
  const [decompressModal, setDecompressModal] = useState(false);
  const [decompressTarget, setDecompressTarget] = useState<string | null>(null);
  const [decompressPwd, setDecompressPwd] = useState("");
  const [testResult, setTestResult] = useState<DecompressInfo | null>(null);
  const [renameModal, setRenameModal] = useState(false);
  const [renameName, setRenameName] = useState("");
  const [infoResult, setInfoResult] = useState<CompressInfo | null>(null);
  const [compressFiles, setCompressFiles] = useState<string[]>([]);

  const pickerRef = useRef<HTMLInputElement>(null);
  const decompPickerRef = useRef<HTMLInputElement>(null);
  const [msgApi, contextHolder] = message.useMessage();
  const loadSeq = useRef(0);
  const bootstrapped = useRef(false);

  // ── password cache + prompt ────────────────────────────
  const pwdCache = useRef<Map<string, string | null>>(new Map());
  const [pwdPrompt, setPwdPrompt] = useState<{
    archive: string;
    resolver: (pwd: string | null) => void;
    retry?: boolean;
  } | null>(null);
  const [pwdInput, setPwdInput] = useState("");

  const invalidatePwd = useCallback((archive: string) => {
    pwdCache.current.delete(archive);
  }, []);

  const askPassword = useCallback(
      (archive: string, retry = false) =>
          new Promise<string | null>((resolve) => {
            setPwdInput("");
            setPwdPrompt({ archive, resolver: resolve, retry });
          }),
      [],
  );

  const pushRecent = useCallback((p: string) => {
    setRecentPaths((prev) => {
      const next = [p, ...prev.filter((x) => x !== p)].slice(0, 10);
      cmd.save_recent(next).catch(() => {});
      return next;
    });
  }, []);

  /** Ensure we have a password for `archive` if it is encrypted.
   *  Returns password string, null if not needed, or undefined if the user cancelled. */
  const ensurePassword = useCallback(
      async (archive: string): Promise<string | null | undefined> => {
        if (pwdCache.current.has(archive)) {
          return pwdCache.current.get(archive) ?? null;
        }
        try {
          const needs = await cmd.compress_password_detect(archive);
          if (!needs) {
            pwdCache.current.set(archive, null);
            return null;
          }
        } catch {
          // fall through
        }
        const input = await askPassword(archive);
        if (input === null) return undefined;
        pwdCache.current.set(archive, input);
        return input;
      },
      [askPassword],
  );

  const withPassword = useCallback(
      async <T,>(archive: string, op: (pwd: string | null) => Promise<T>): Promise<T | undefined> => {
        const pwd = await ensurePassword(archive);
        if (pwd === undefined) return undefined;
        try {
          return await op(pwd);
        } catch (err) {
          if (isPasswordError(err) && pwd !== null) {
            invalidatePwd(archive);
            const retryPwd = await askPassword(archive, true);
            if (retryPwd === null) {
              Modal.error({ title: "解压失败", content: "密码错误，已取消操作" });
              return undefined;
            }
            pwdCache.current.set(archive, retryPwd);
            try {
              return await op(retryPwd);
            } catch (err2) {
              invalidatePwd(archive);
              Modal.error({
                title: "解压失败",
                content: err2 instanceof Error ? err2.message : String(err2),
              });
              return undefined;
            }
          }
          throw err;
        }
      },
      [ensurePassword, askPassword, invalidatePwd],
  );

  // ── load entries ───────────────────────────────────────
  const loadEntries = useCallback(async (path: string) => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setSelectedKeys([]);
    setAddressValue(path);
    try {
      const archive = archivePathOf(path);
      const doList = (pwd: string | null) => cmd.list_dir(path, pwd);
      let data: Entry[];
      if (archive) {
        const r = await withPassword(archive, doList);
        if (r === undefined || seq !== loadSeq.current) return;
        data = r;
      } else {
        data = await doList(null);
        if (seq !== loadSeq.current) return;
      }
      setCurrentPath(path);
      setEntries(data);
      pushRecent(path);
    } catch (e: unknown) {
      const archive = archivePathOf(path);
      if (archive && isPasswordError(e)) {
        invalidatePwd(archive);
        Modal.error({
          title: "解压失败",
          content: e instanceof Error ? e.message : String(e),
        });
      } else {
        msgApi.error(`加载目录失败: ${e instanceof Error ? e.message : String(e)}`);
      }
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [invalidatePwd, msgApi, pushRecent, withPassword]);

  // ── init ───────────────────────────────────────────────
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    (async () => {
      try {
        const list = await cmd.load_recent();
        setRecentPaths(list);
      } catch {}

      try {
        const pending = await cmd.take_pending_open_path();
        const path = pending ?? await cmd.get_default_dir();
        setAddressValue(path);
        await loadEntries(path);
      } catch (e: unknown) {
        const path = e instanceof Error ? e.message : String(e);
        setErrorMsg(path);
        setErrorOpen(true);
        setInitErr(path);
      }
    })();
  }, [loadEntries]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string>(EXTERNAL_OPEN_EVENT, (event) => {
      if (event.payload) {
        setAddressValue(event.payload);
        void loadEntries(event.payload);
      }
    }).then((fn) => {
      unlisten = fn;
    }).catch(() => {});

    return () => {
      unlisten?.();
    };
  }, [loadEntries]);

  // ── selection ──────────────────────────────────────────
  const selectedRows = entries.filter((e) => selectedKeys.includes(e.path));

  const handleGo = () => { if (addressValue) void loadEntries(addressValue); };

  const handleUp = () => {
    if (!isInCompress(currentPath)) {
      const parts = currentPath.replace(/\/+$/, "").split("/");
      if (parts.length > 1) {
        const parent = parts.slice(0, -1).join("/");
        void loadEntries(parent);
      }
    } else {
      const idx = currentPath.lastIndexOf("/");
      if (idx > currentPath.indexOf("!")) {
        const parent = currentPath.slice(0, idx);
        void loadEntries(parent);
      }
    }
  };

  const handleFolderPick = () => pickerRef.current?.click();
  const onFolderPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f?.path) void loadEntries(f.path);
    e.target.value = "";
  };

  const handleAdd = () => {
    if (isInCompress(currentPath) && selectedRows.length === 0) {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.multiple = true;
      inp.style.display = "none";
      inp.onchange = async () => {
        const files = Array.from(inp.files ?? []);
        if (!files.length) return;
        const archivePath = currentPath.split("!")[0];
        setLoading(true);
        try {
          let lastResult: CompressInfo | null = null;
          for (const file of files) {
            if (!file.path) continue;
            const r = await withPassword(archivePath, (pwd) =>
                cmd.compress_add(archivePath, file.path!, pwd),
            );
            if (r === undefined) return;
            lastResult = r;
          }
          if (lastResult) {
            msgApi.success(`已添加 ${lastResult.file_count} 个文件`);
            void loadEntries(currentPath);
          }
        } catch (err: unknown) {
          msgApi.error(`添加文件失败: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setLoading(false);
        }
      };
      document.body.appendChild(inp);
      inp.click();
      document.body.removeChild(inp);
    } else if (!isInCompress(currentPath)) {
      if (selectedRows.length === 0) {
        msgApi.info("请先选择要压缩的文件或目录");
        return;
      }
      setCompressFiles(selectedRows.map((r) => r.path));
      setCompressModal(true);
    } else {
      const archivePath = currentPath.split("!")[0];
      setLoading(true);
      (async () => {
        try {
          let lastResult: CompressInfo | null = null;
          for (const row of selectedRows) {
            const r = await withPassword(archivePath, (pwd) =>
                cmd.compress_add(archivePath, row.path, pwd),
            );
            if (r === undefined) return;
            lastResult = r;
          }
          if (lastResult) {
            msgApi.success(`已添加 ${lastResult.file_count} 个文件`);
            void loadEntries(currentPath);
          }
        } catch (err: unknown) {
          msgApi.error(`添加失败: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setLoading(false);
        }
      })();
    }
  };

  const handleDecompress = () => {
    setDecompressTarget(null);
    setDecompressPwd("");
    setDecompressModal(true);
  };

  const handleDecompressPick = () => decompPickerRef.current?.click();
  const onDecompressPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f?.path) setDecompressTarget(f.path);
    e.target.value = "";
  };

  const doDecompress = async () => {
    const path = selectedRows.length > 0 ? selectedRows[0].path : currentPath;
    const archive = archivePathOf(path) ?? path.split("!")[0];
    setLoading(true);
    try {
      const explicit = decompressPwd || null;
      const doOp = (pwd: string | null) => cmd.decompress(path, pwd, decompressTarget);
      const result = explicit ? await doOp(explicit) : await withPassword(archive, doOp);
      if (result === undefined) return;
      Modal.success({
        title: "解压完成",
        content: (
            <Space direction="vertical">
              <span>解压大小: {fmtSize(result.size)}</span>
              <span>文件数量: {result.file_count}</span>
              <span>耗时: {fmtCost(result.cost)}</span>
            </Space>
        ),
        width: 360,
      });
      setDecompressModal(false);
    } catch (err: unknown) {
      if (isPasswordError(err)) invalidatePwd(archive);
      Modal.error({
        title: "解压失败",
        content: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    const path = selectedRows.length > 0 ? selectedRows[0].path : currentPath;
    const archive = archivePathOf(path) ?? path.split("!")[0];
    setLoading(true);
    setTestResult(null);
    try {
      const result = await withPassword(archive, (pwd) => cmd.decompress_test(path, pwd));
      if (result) setTestResult(result);
    } catch (err: unknown) {
      if (isPasswordError(err)) invalidatePwd(archive);
      Modal.error({
        title: "测试失败",
        content: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!selectedRows.length) {
      msgApi.info("请先选择要删除的文件");
      return;
    }
    Modal.confirm({
      title: "确认删除",
      content: `确定要从压缩包中删除选中的 ${selectedRows.length} 个条目吗？`,
      okText: "删除",
      okButtonProps: { danger: true },
      onOk: async () => {
        const archive = currentPath.split("!")[0];
        setLoading(true);
        try {
          const paths = selectedRows.map((r) => r.path);
          const result = await withPassword(archive, (pwd) => cmd.compress_remove(paths, pwd));
          if (result === undefined) return;
          msgApi.success(`已删除 ${result.file_count} 个条目，耗时 ${fmtCost(result.cost)}`);
          void loadEntries(currentPath);
        } catch (err: unknown) {
          if (isPasswordError(err)) invalidatePwd(archive);
          Modal.error({ title: "删除失败", content: err instanceof Error ? err.message : String(err) });
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleRename = () => {
    if (!selectedRows.length) {
      msgApi.info("请先选择要重命名的文件");
      return;
    }
    setRenameName(selectedRows[0].name);
    setRenameModal(true);
  };

  const doRename = async () => {
    if (!renameName.trim()) {
      msgApi.warning("名称不能为空");
      return;
    }
    if (!selectedRows.length) return;
    const oldName = selectedRows[0].name;
    if (renameName === oldName) {
      setRenameModal(false);
      return;
    }
    const archive = currentPath.split("!")[0];
    setLoading(true);
    try {
      const result = await withPassword(archive, (pwd) =>
          cmd.compress_rename(selectedRows[0].path, renameName.trim(), pwd),
      );
      if (result === undefined) return;
      msgApi.success(`重命名成功: ${oldName} → ${renameName.trim()}，耗时 ${fmtCost(result.cost)}`);
      setRenameModal(false);
      void loadEntries(currentPath);
    } catch (err: unknown) {
      if (isPasswordError(err)) invalidatePwd(archive);
      Modal.error({ title: "重命名失败", content: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleInfo = async () => {
    if (!selectedRows.length) {
      msgApi.info("请先选择文件");
      return;
    }
    const path = selectedRows[0].path;
    const archive = archivePathOf(path) ?? path.split("!")[0];
    setLoading(true);
    try {
      const result = await withPassword(archive, (pwd) => cmd.compress_info(path, pwd));
      if (result) setInfoResult(result);
    } catch (err: unknown) {
      if (isPasswordError(err)) invalidatePwd(archive);
      Modal.error({ title: "获取信息失败", content: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleCompressSubmit = async (values: {
    type: CompressParam["type"];
    level?: number;
    password?: string;
    volume?: string;
  }) => {
    setLoading(true);
    try {
      const param: CompressParam = {
        type: values.type,
        level: values.level ?? null,
        password: values.password || null,
        volume: values.volume || null,
      };
      const result = await cmd.compress(compressFiles, param, null);
      msgApi.success(`压缩完成: ${result.file_count} 个文件，${fmtSize(result.size)}，耗时 ${fmtCost(result.cost)}`);
      setCompressModal(false);
      if (!isInCompress(currentPath)) {
        const parent = currentPath.replace(/\/+$/, "").split("/").slice(0, -1).join("/") || "/";
        void loadEntries(parent);
      } else {
        void loadEntries(currentPath);
      }
    } catch (err: unknown) {
      msgApi.error(`压缩失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          (e.target as HTMLElement).isContentEditable
      ) return;

      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      const map: Record<string, () => void> = {
        a: handleAdd,
        e: handleDecompress,
        t: handleTest,
        d: handleDelete,
        r: handleRename,
        i: handleInfo,
      };

      if (mod && key in map) {
        e.preventDefault();
        map[key]();
        return;
      }

      if (key === "enter" && document.activeElement?.id === "address-input") {
        e.preventDefault();
        handleGo();
      }

      if (key === "backspace") {
        e.preventDefault();
        handleUp();
      }

      if (key === "escape") {
        setSelectedKeys([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentPath, selectedRows, entries]);

  const columns: ColumnsType<Entry> = [
    {
      title: "",
      dataIndex: "type",
      key: "_icon",
      width: 48,
      render: (_: unknown, r: Entry) => <span style={{ fontSize: 20 }}>{entryIcon(r.type)}</span>,
    },
    {
      title: "名称",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
      render: (name: string, r: Entry) => (
          <span style={r.type === "dir" ? { fontWeight: 600 } : undefined}>{name}</span>
      ),
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 100,
      render: (t: string) => {
        const labels: Record<string, { color: string; label: string }> = {
          dir: { color: "gold", label: "目录" },
          compress: { color: "orange", label: "压缩包" },
          image: { color: "green", label: "图片" },
          audio: { color: "purple", label: "音频" },
          video: { color: "blue", label: "视频" },
          other: { color: "default", label: "文件" },
        };
        const c = labels[t] ?? labels.other;
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: "大小",
      dataIndex: "size",
      key: "size",
      width: 120,
      align: "right",
      sorter: (a: Entry, b: Entry) => a.size - b.size,
      render: (v: number) => fmtSize(v),
    },
    {
      title: "修改时间",
      dataIndex: "mtime",
      key: "mtime",
      width: 200,
      sorter: (a: Entry, b: Entry) => a.mtime - b.mtime,
      render: (v: number) => fmtTime(v),
    },
  ];

  const inCompress = isInCompress(currentPath);
  const selCount = selectedRows.length;
  const selSize = selectedRows.reduce((s, r) => s + r.size, 0);

  return (
      <ConfigProvider
          theme={{
            token: { borderRadius: 6 },
            components: { Table: { padding: 12, fontSize: 14 } },
          }}
      >
        {contextHolder}
        <div style={{ display: "flex", flexDirection: "column", height: "100vh", userSelect: "none" }}>
          <Menu
              mode="horizontal"
              style={{ flex: "none", borderBottom: "1px solid #f0f0f0", lineHeight: "32px" }}
              items={[
                {
                  key: "file",
                  label: "文件",
                  children: [
                    { key: "open", label: "打开", icon: <FolderOpenOutlined />, onClick: handleFolderPick },
                    { type: "divider" as const },
                    ...(recentPaths.length > 0
                        ? [
                          { key: "recent-label", label: "最近打开", disabled: true, style: { color: "#999", fontSize: 12, lineHeight: "20px" } },
                          ...recentPaths.slice(0, 5).map((p) => ({ key: `recent-${p}`, label: p.length > 50 ? `...${p.slice(-47)}` : p, onClick: () => void loadEntries(p) })),
                          { type: "divider" as const },
                        ]
                        : []),
                    { key: "close", label: "关闭", disabled: true },
                    { type: "divider" as const },
                    { key: "quit", label: "退出" },
                  ],
                },
                {
                  key: "help",
                  label: "帮助",
                  children: [
                    { key: "settings", label: "设置", onClick: () => setSettingsOpen(true) },
                    { type: "divider" as const },
                    { key: "about", label: "关于", icon: <QuestionCircleOutlined />, onClick: () => setAboutOpen(true) },
                  ],
                },
              ]}
              selectable={false}
          />

          <div style={{ flex: "none", padding: "6px 12px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 4, background: "#fafafa" }}>
            <Button icon={<PlusOutlined />} onClick={handleAdd} title="添加 (⌘A)">添加</Button>
            <Button icon={<InboxOutlined />} onClick={handleDecompress} disabled={!inCompress} title="解压 (⌘E)">解压</Button>
            <Button icon={<ExperimentOutlined />} onClick={handleTest} disabled={!inCompress} title="测试 (⌘T)">测试</Button>
            <div style={{ width: 1, height: 20, background: "#d9d9d9", margin: "0 6px" }} />
            <Button icon={<DeleteOutlined />} onClick={handleDelete} danger disabled={!inCompress || selCount === 0} title="删除 (⌘D)">删除</Button>
            <Button icon={<EditOutlined />} onClick={handleRename} disabled={!inCompress || selCount === 0} title="重命名 (⌘R)">重命名</Button>
            <div style={{ width: 1, height: 20, background: "#d9d9d9", margin: "0 6px" }} />
            <Button icon={<InfoCircleOutlined />} onClick={handleInfo} disabled={!inCompress || selCount === 0} title="信息 (⌘I)">信息</Button>
          </div>

          <div style={{ flex: "none", padding: "6px 12px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 8 }}>
            <Input id="address-input" value={addressValue} onChange={(e) => setAddressValue(e.target.value)} onPressEnter={handleGo} placeholder="输入路径..." allowClear style={{ flex: 1 }} />
            <Button type="primary" icon={<ArrowRightOutlined />} onClick={handleGo}>转到</Button>
            <Button icon={<ArrowUpOutlined />} onClick={handleUp} title="上级目录 (Backspace)">上级</Button>
            <Button icon={<FolderOpenOutlined />} onClick={handleFolderPick}>选择</Button>
            <input ref={pickerRef} type="file" // @ts-ignore
                   webkitdirectory="" style={{ display: "none" }} onChange={onFolderPicked} />
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: 8 }}>
            <Table<Entry>
                columns={columns}
                dataSource={entries}
                rowKey="path"
                loading={loading}
                size="middle"
                rowSelection={{ selectedRowKeys: selectedKeys, onChange: (keys) => setSelectedKeys(keys), preserveSelectedRowKeys: true }}
                onRow={(record: Entry) => ({
                  onClick: () => setSelectedKeys([record.path]),
                  onDoubleClick: () => {
                    if (record.type === "dir") {
                      const next = currentPath ? `${currentPath}/${record.name}` : record.name;
                      void loadEntries(next);
                    }
                  },
                  style: { cursor: "pointer" },
                })}
                pagination={{ size: "small", showSizeChanger: true, pageSizeOptions: ["50", "100", "200", "500"], defaultPageSize: 200, showTotal: (total) => `共 ${total} 项`, style: { margin: "8px 0 0" } }}
                scroll={{ y: "100%" }}
                locale={{ emptyText: "目录为空" }}
            />
          </div>

          <div style={{ flex: "none", padding: "4px 16px", borderTop: "1px solid #f0f0f0", background: "#fafafa", fontSize: 13, color: "#666", display: "flex", justifyContent: "space-between" }}>
            <span>已选择 {selCount} / {entries.length}{selCount > 0 && ` | 选中大小 ${fmtSize(selSize)}`}</span>
            <span>总大小 {fmtSize(entries.reduce((s, r) => s + r.size, 0))}</span>
          </div>

          <Modal title="错误" open={errorOpen} onCancel={() => setErrorOpen(false)} footer={[<Button key="close" type="primary" danger onClick={() => setErrorOpen(false)}>关闭</Button>]} closable={false} maskClosable={false}>
            <p>无法打开目录: {errorMsg}</p>
            <p style={{ color: "#999", fontSize: 12 }}>程序即将退出。</p>
          </Modal>

          <Modal title="解压" open={decompressModal} onOk={doDecompress} onCancel={() => setDecompressModal(false)} okText="解压" cancelText="取消">
            <Form layout="vertical" style={{ marginTop: 16 }}>
              <Form.Item label="目标目录（可选）">
                <Space.Compact style={{ width: "100%" }}>
                  <Input value={decompressTarget ?? ""} readOnly placeholder="不选则使用默认目录" />
                  <Button onClick={handleDecompressPick}>浏览...</Button>
                </Space.Compact>
                <input ref={decompPickerRef} type="file" // @ts-ignore
                       webkitdirectory="" style={{ display: "none" }} onChange={onDecompressPicked} />
              </Form.Item>
              <Form.Item label="密码（可选）">
                <Input.Password value={decompressPwd} onChange={(e) => setDecompressPwd(e.target.value)} placeholder="输入压缩包密码" />
              </Form.Item>
            </Form>
          </Modal>

          <Modal title="测试结果" open={testResult !== null} onOk={() => setTestResult(null)} cancelButtonProps={{ style: { display: "none" } }}>
            {testResult && <Space direction="vertical" style={{ marginTop: 16 }}><span>解压大小: {fmtSize(testResult.size)}</span><span>文件数量: {testResult.file_count}</span><span>耗时: {fmtCost(testResult.cost)}</span></Space>}
          </Modal>

          <Modal title="重命名" open={renameModal} onOk={doRename} onCancel={() => setRenameModal(false)} okText="确认" cancelText="取消" confirmLoading={loading} okButtonProps={{ disabled: !renameName.trim() }} destroyOnClose>
            <Form layout="vertical" style={{ marginTop: 16 }}>
              <Form.Item label="新名称" help={selectedRows.length ? `原名称: ${selectedRows[0].name}` : undefined}>
                <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} onPressEnter={doRename} autoFocus onFocus={(e) => {
                  const v = e.target.value;
                  const dot = v.lastIndexOf(".");
                  if (dot > 0) e.target.setSelectionRange(0, dot);
                  else e.target.select();
                }} />
              </Form.Item>
            </Form>
          </Modal>

          <Modal title="压缩包信息" open={infoResult !== null} onOk={() => setInfoResult(null)} cancelButtonProps={{ style: { display: "none" } }}>
            {infoResult && <Space direction="vertical" style={{ marginTop: 16 }}><span>总大小: {fmtSize(infoResult.size)}</span><span>文件数量: {infoResult.file_count}</span><span>耗时: {fmtCost(infoResult.cost)}</span></Space>}
          </Modal>

          <CompressModal open={compressModal} onCancel={() => setCompressModal(false)} onSubmit={handleCompressSubmit} />

          <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} isMac={isMac} isWindows={isWindows} isLinux={isLinux} onMessage={(kind, text) => msgApi[kind](text)} />

          <Modal title="关于 rszip" open={aboutOpen} onCancel={() => setAboutOpen(false)} footer={[<Button key="close" type="primary" onClick={() => setAboutOpen(false)}>关闭</Button>]}>
            <Space direction="vertical" style={{ marginTop: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>rszip v0.1.0</span>
              <span style={{ color: "#999" }}>基于 Tauri + React + Ant Design 构建</span>
              <span style={{ color: "#999" }}>文件浏览与压缩管理工具</span>
            </Space>
          </Modal>

          <Modal title="需要密码" open={pwdPrompt !== null} onOk={() => {
            if (!pwdPrompt) return;
            if (!pwdInput) {
              msgApi.warning("密码不能为空");
              return;
            }
            pwdPrompt.resolver(pwdInput);
            setPwdPrompt(null);
          }} onCancel={() => {
            pwdPrompt?.resolver(null);
            setPwdPrompt(null);
          }} okText="确认" cancelText="取消" maskClosable={false} destroyOnClose>
            {pwdPrompt && (
                <Form layout="vertical" style={{ marginTop: 16 }}>
                  <Form.Item label="密码" help={<span style={{ color: pwdPrompt.retry ? "#ff4d4f" : "#999" }}>{pwdPrompt.retry ? "密码错误，请重试" : `压缩包: ${pwdPrompt.archive.split("/").pop()}`}</span>} validateStatus={pwdPrompt.retry ? "error" : undefined}>
                    <Input.Password value={pwdInput} onChange={(e) => setPwdInput(e.target.value)} autoFocus onPressEnter={() => {
                      if (!pwdInput) return;
                      pwdPrompt.resolver(pwdInput);
                      setPwdPrompt(null);
                    }} placeholder="输入压缩包密码" />
                  </Form.Item>
                </Form>
            )}
          </Modal>
        </div>
      </ConfigProvider>
  );
}

export default App;
