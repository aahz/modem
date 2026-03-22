import { Button, Flex, Text, View } from "@adobe/react-spectrum";
import { Principal } from "../types";

interface SessionBarProps {
  user: Principal;
  onLogout: () => void;
}

export function SessionBar({ user, onLogout }: SessionBarProps) {
  return (
    <View backgroundColor="gray-75" padding="size-200" borderRadius="medium">
      <Flex justifyContent="space-between" alignItems="center">
        <Text>
          {user.username} ({user.role})
        </Text>
        <Button variant="negative" onPress={onLogout}>
          Logout
        </Button>
      </Flex>
    </View>
  );
}
