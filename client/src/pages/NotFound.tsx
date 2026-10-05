import { Link } from 'react-router-dom';
import { NotFoundArt } from '../components/Illustrations';
export default function NotFound() {
  return (<div className="flex flex-col items-center py-16 text-center"><NotFoundArt /><h1 className="mt-4 font-display text-3xl font-semibold">This page wandered off</h1><p className="mt-2 text-muted">Let us get you back on schedule.</p><Link to="/" className="btn-primary mt-6">Back home</Link></div>);
}
