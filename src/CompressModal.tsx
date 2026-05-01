import { useEffect } from "react";
import { Modal, Form, Select, Slider, Input, Space, Button } from "antd";
import type { CompressParam } from "./types";

interface Props {
  open: boolean;
  onCancel: () => void;
  onSubmit: (values: {
    type: CompressParam["type"];
    level?: number;
    password?: string;
    volume?: string;
  }) => void;
}

const ALGO_CAPS: Record<
  CompressParam["type"],
  { level: boolean; password: boolean; volume: boolean; defaultLevel?: number }
> = {
  zip: { level: true, password: true, volume: false, defaultLevel: 6 },
  "7z": { level: true, password: true, volume: true, defaultLevel: 5 },
  gzip: { level: true, password: false, volume: false, defaultLevel: 6 },
  bzip2: { level: false, password: false, volume: false },
  xz: { level: false, password: false, volume: false },
};

export function CompressModal({ open, onCancel, onSubmit }: Props) {
  const [form] = Form.useForm();
  const type = (Form.useWatch("type", form) ?? "zip") as CompressParam["type"];
  const caps = ALGO_CAPS[type];

  // reset level default when type changes
  useEffect(() => {
    if (caps.level) {
      form.setFieldValue("level", caps.defaultLevel);
    } else {
      form.setFieldValue("level", undefined);
    }
    if (!caps.password) form.setFieldValue("password", undefined);
    if (!caps.volume) form.setFieldValue("volume", undefined);
  }, [type, caps, form]);

  // reset entire form when re-opened
  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  return (
    <Modal
      title="压缩"
      open={open}
      footer={null}
      onCancel={onCancel}
      width={480}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 16 }}
        onFinish={onSubmit}
        initialValues={{ type: "zip", level: 6 }}
      >
        <Form.Item
          label="压缩格式"
          name="type"
          rules={[{ required: true, message: "请选择压缩格式" }]}
        >
          <Select>
            <Select.Option value="zip">ZIP（默认）</Select.Option>
            <Select.Option value="7z">7Z</Select.Option>
            <Select.Option value="gzip">GZIP</Select.Option>
            <Select.Option value="bzip2">BZIP2</Select.Option>
            <Select.Option value="xz">XZ</Select.Option>
          </Select>
        </Form.Item>

        {caps.level && (
          <Form.Item label="压缩等级 (1-9)" name="level">
            <Slider min={1} max={9} marks={{ 1: "1", 5: "5", 9: "9" }} />
          </Form.Item>
        )}

        {caps.password && (
          <Form.Item label="密码（可选）" name="password">
            <Input.Password placeholder="设置压缩密码" autoComplete="new-password" />
          </Form.Item>
        )}

        {caps.volume && (
          <Form.Item
            label="分卷大小（可选）"
            name="volume"
            rules={[
              {
                pattern: /^\d+[bkmg]$/i,
                message: "格式如 100m、1g，单位 b/k/m/g",
              },
            ]}
          >
            <Input placeholder="例: 100m, 1g" />
          </Form.Item>
        )}

        {!caps.level && !caps.password && !caps.volume && (
          <div style={{ color: "#999", marginBottom: 16, fontSize: 13 }}>
            该格式无可配置参数
          </div>
        )}

        <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" htmlType="submit">
              开始压缩
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
