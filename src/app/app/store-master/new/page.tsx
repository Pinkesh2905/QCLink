import type { Metadata } from 'next';
import { ItemForm } from '@/components/store-master/item-form';

export const metadata: Metadata = {
  title: 'Store Master | New Item',
  description: 'Add a new inventory item to Store Master',
};

export default function NewItemPage() {
  return <ItemForm isEdit={false} />;
}
