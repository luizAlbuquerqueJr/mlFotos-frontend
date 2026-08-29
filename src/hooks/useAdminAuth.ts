import { useEffect, useState } from "react";
import { subscribeAdminAuth } from "@/lib/firebaseAuth";

export function useIsAdminAuthenticated() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => subscribeAdminAuth(setIsAdmin), []);

  return isAdmin;
}
