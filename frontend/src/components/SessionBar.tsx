import { Button, Text } from "@react-spectrum/s2";
import { Principal } from "../types";

interface SessionBarProps {
  user: Principal;
  onLogout: () => void;
}

export function SessionBar({ user, onLogout }: SessionBarProps) {
  return (
    <div style={{ background: "#f3f3f3", padding: "16px", borderRadius: "8px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <Text>
          {user.username} ({user.role})
        </Text>
        <Button variant="negative" onPress={onLogout}>
          Logout
        </Button>
      </div>
    </div>
  );
}
