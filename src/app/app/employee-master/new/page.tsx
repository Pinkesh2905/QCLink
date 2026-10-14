import type { Metadata } from 'next';
import { EmployeeForm } from '@/components/employee-master/employee-form';

export const metadata: Metadata = {
  title: 'Employee Master | New Employee',
  description: 'Add an employee who can review inspection reports',
};

export default function NewEmployeePage() {
  return <EmployeeForm isEdit={false} />;
}
