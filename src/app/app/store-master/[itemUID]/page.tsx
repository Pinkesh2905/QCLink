import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { ItemForm } from '@/components/store-master/item-form';
import type { ItemWithLookups } from '@/types/db';

interface ItemDetailPageProps {
  params: Promise<{ itemUID: string }>;
}

export async function generateMetadata({ params }: ItemDetailPageProps): Promise<Metadata> {
  const { itemUID } = await params;
  return {
    title: `Store Master | ${itemUID}`,
    description: `View and edit item ${itemUID}`,
  };
}

export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const { itemUID } = await params;

  const rows = await query<ItemWithLookups>(
    `SELECT i.*, c.CategoryName, u.UOMName, sc.SubCategoryName, usr.Name AS OwnerName
     FROM Items i
     LEFT JOIN Categories c ON i.CategoryID = c.CategoryID
     LEFT JOIN UnitOfStock u ON i.UOMID = u.UOMID
     LEFT JOIN SubCategories sc ON i.SubCategoryID = sc.SubCategoryID
     LEFT JOIN Users usr ON i.OwnerUserID = usr.UserID
     WHERE i.ItemUID = ?`,
    [itemUID]
  );

  if (rows.length === 0) {
    notFound();
  }

  const item = rows[0];

  return <ItemForm initialData={item} isEdit={true} />;
}
