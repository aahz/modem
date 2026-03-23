import { ActionButton, TextArea, TextField } from "@react-spectrum/s2";
import { style } from '@react-spectrum/s2/style' with {type: 'macro'};

interface AtCommandsPanelProps {
  command: string;
  timeoutMs: string;
  response: string;
  onCommandChange: (value: string) => void;
  onTimeoutChange: (value: string) => void;
  onResponseChange: (value: string) => void;
  onSend: () => void;
}

export function AtCommandsPanel(props: AtCommandsPanelProps) {
  return (
    <section className={style({display: 'flex', flexDirection: 'column', gap: 16})}>
      <form
        className={style({
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'start',
          alignItems: 'end',
          gap: 16,
      })}
        onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();

            props.onSend();
        }}>
          <div
              style={{flex: 3}}>
            <TextField
              label="Command"
              value={props.command}
              onChange={props.onCommandChange}
            />
          </div>

          <div
              style={{flex: 1}}>
            <TextField
              label="Timeout"
              value={props.timeoutMs}
              onChange={props.onTimeoutChange}
            />
          </div>

        <ActionButton type="submit">
          Execute
        </ActionButton>
      </form>

      <TextArea
        value={props.response}
        isReadOnly
        onChange={props.onResponseChange}
      />
    </section>
  );
}
