import { Input } from "@/components/ui/input";

export const UserManagementToolbar = ({
  query,
  setQuery,
}: {
  query: string;
  setQuery: (value: string) => void;
}) => (
  <div className="border-b border-border/60 px-6 py-4">
    <Input
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder="Search by name, email, or role"
      aria-label="Search users"
      className="max-w-sm"
    />
  </div>
);
