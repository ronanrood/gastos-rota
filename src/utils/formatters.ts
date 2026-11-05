/**
 * Utilitários de Máscaras e Formatações para o Gastos Rota
 */

// Formata CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) dinamicamente
export const formatCpfCnpj = (value: string | number | null | undefined): string => {
  const str = String(value ?? '');
  const digits = str.replace(/\D/g, '').slice(0, 14);

  if (digits.length === 0) return '';

  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }

  // CNPJ: 00.000.000/0000-00
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

// Formata Telefone / WhatsApp: (00) 00000-0000 ou (00) 0000-0000
export const formatPhone = (value: string | number | null | undefined): string => {
  const str = String(value ?? '');
  const digits = str.replace(/\D/g, '').slice(0, 11);

  if (digits.length === 0) return '';
  if (digits.length <= 2) {
    return `(${digits}`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

// Formata CEP: 00000-000
export const formatCep = (value: string | number | null | undefined): string => {
  const str = String(value ?? '');
  const digits = str.replace(/\D/g, '').slice(0, 8);
  if (digits.length === 0) return '';
  if (digits.length <= 5) {
    return digits;
  }
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

// Retorna as 2 iniciais do nome para o Avatar fallback
export const getInitials = (name?: string | null): string => {
  const str = typeof name === 'string' ? name.trim() : (name ? String(name).trim() : '');
  if (!str) return 'MR';
  const parts = str.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
