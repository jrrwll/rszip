import { useEffect, useState } from "react";
import { Modal, Checkbox, Spin, Space, Typography, Divider } from "antd";
import * as cmd from "./commands";

const SUPPORTED_EXTS = ["7z", "zip", "rar", "gz", "bz2", "xz"] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  isMac: boolean;
  isWindows: boolean;
  isLinux: boolean;
  onMessage?: (kind: "success" | "error", text: string) => void;
}

const APP_BID = "org.dreamcat.rszip";
const isOursHandler = (v: string | undefined): boolean => {
  if (!v) return false;
  const s = v.toLowerCase();
  return s === APP_BID.toLowerCase() || s === "rszip.desktop" || s.includes("rszip");
};

export function SettingsModal({
  open,
  onClose,
  isMac,
  isWindows,
  isLinux,
  onMessage,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [handlers, setHandlers] = useState<Record<string, string>>({});
  const [defaultExts, setDefaultExts] = useState<string[]>([]);
  const [ctxDirEnabled, setCtxDirEnabled] = useState(false);

  const supportsDirContextMenu = isMac || isWindows || isLinux;

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      cmd.get_default_handlers(),
      supportsDirContextMenu
        ? cmd.get_context_menu_enabled()
        : Promise.resolve({} as Record<string, boolean>),
    ])
      .then(([hmap, cmap]) => {
        setHandlers(hmap);
        setDefaultExts(SUPPORTED_EXTS.filter((e) => isOursHandler(hmap[e])));
        setCtxDirEnabled(Boolean(cmap.dir));
      })
      .catch((err) => {
        onMessage?.(
          "error",
          `读取设置失败: ${err instanceof Error ? err.message : String(err)}`,
        );
      })
      .finally(() => setLoading(false));
  }, [open, onMessage, supportsDirContextMenu]);

  const handleOk = async () => {
    setSaving(true);
    try {
      await cmd.set_default_handlers(defaultExts);
      if (supportsDirContextMenu) {
        await cmd.set_context_menu_enabled(ctxDirEnabled ? ["dir"] : []);
      }
      onMessage?.("success", "设置已保存");
      onClose();
    } catch (err) {
      onMessage?.(
        "error",
        `保存失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="设置"
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      destroyOnClose
      width={520}
    >
      <Spin spinning={loading}>
        <Typography.Title level={5} style={{ marginTop: 0 }}>
          默认打开方式
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 8, color: "#666" }}>
          勾选的格式将使用 <b>rszip</b> 作为默认打开方式，未勾选的将还原为系统默认。
        </Typography.Paragraph>

        <Checkbox.Group
          value={defaultExts}
          onChange={(v) => setDefaultExts((v as unknown[]).map(String))}
          style={{ width: "100%" }}
        >
          <Space direction="vertical" style={{ width: "100%" }}>
            {SUPPORTED_EXTS.map((ext) => {
              const cur = handlers[ext];
              const ours = isOursHandler(cur);
              return (
                <Checkbox key={ext} value={ext}>
                  <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                    .{ext}
                  </span>
                  <span style={{ color: "#999", marginLeft: 12, fontSize: 12 }}>
                    {ours ? "当前: rszip" : cur ? `当前: ${cur}` : "当前: 系统默认"}
                  </span>
                </Checkbox>
              );
            })}
          </Space>
        </Checkbox.Group>

        {supportsDirContextMenu && (
          <>
            <Divider style={{ margin: "20px 0 12px" }} />
            <Typography.Title level={5} style={{ marginTop: 0 }}>
              系统文件浏览器目录右键菜单
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 8, color: "#666" }}>
              勾选后，在系统文件浏览器中对目录右键即可看到 <b>用 rszip 打开</b> 菜单项。
              如果 app 已在运行，会切换现有窗口并打开该目录；否则会冷启动并优先打开该目录。
              文件右键已由“默认打开方式”控制，此处不再重复。
            </Typography.Paragraph>

            <Checkbox
              checked={ctxDirEnabled}
              onChange={(e) => setCtxDirEnabled(e.target.checked)}
            >
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>目录</span>
            </Checkbox>

            <Typography.Paragraph
              style={{ color: "#999", fontSize: 12, marginTop: 16, marginBottom: 0 }}
            >
              {isMac &&
                "提示: macOS 修改后可能需要注销/重登录，或执行 /System/Library/CoreServices/pbs -update 才会在 Finder 生效。"}
              {isWindows &&
                "提示: Windows 仅作用于当前用户；修改后资源管理器可能需要重启后生效。"}
              {isLinux &&
                "提示: Linux 依赖桌面环境/文件管理器集成；通常通过 .desktop action、Nautilus/Nemo 脚本或 xdg 配置生效，可能需要重新登录文件管理器。"}
            </Typography.Paragraph>
          </>
        )}
      </Spin>
    </Modal>
  );
}
