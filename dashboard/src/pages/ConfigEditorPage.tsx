import { ConfigProvider, useConfig } from '../context/ConfigContext';
import { ConfigEditorInner } from './ConfigEditorInner';

export function ConfigEditorPage() {
  return (
    <ConfigProvider>
      <ConfigEditorInner />
    </ConfigProvider>
  );
}
