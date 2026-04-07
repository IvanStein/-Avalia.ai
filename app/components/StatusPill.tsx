import React from "react";
import { Clock, Sparkles, CheckCircle, AlertCircle } from "lucide-react";

export const STATUS_CONFIG = {
  pending:       { label: 'Aguardando',    icon: Clock,        color: '#f59e0b' },
  grading:       { label: 'Corrigindo...', icon: Sparkles,     color: '#6366f1' },
  graded:        { label: 'Corrigido',     icon: CheckCircle,  color: '#10b981' },
  error:         { label: 'Erro',          icon: AlertCircle,  color: '#ef4444' },
  audit_pending: { label: 'Em Auditoria',  icon: AlertCircle,  color: '#f59e0b' },
  audited:       { label: 'Auditado',      icon: CheckCircle,  color: '#10b981' },
};

export function getStatusConfig(status: string) {
  return (STATUS_CONFIG as any)[status] || STATUS_CONFIG.pending;
}
