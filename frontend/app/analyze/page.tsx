import { redirect } from 'next/navigation';

// The analyze route requires an [id] — redirect bare /analyze to home
export default function AnalyzePage() {
  redirect('/');
}
