import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

// Perfect Scrollbar
import 'react-perfect-scrollbar/dist/css/styles.css';

// Tailwind CSS (merged styling system)
import './tailwind.css';

// i18n
import './i18n';

// Router
import { RouterProvider } from 'react-router-dom';
import router from './router/index';

// Redux
import { Provider } from 'react-redux';
import store from './store/index';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <Provider store={store}>
            <Suspense fallback={
                <div className="fixed inset-0 bg-[#fafafa] dark:bg-[#060818] z-[60] grid place-content-center">
                    <LoadingSpinner size="lg" />
                </div>
            }>
                <RouterProvider router={router} />
            </Suspense>
        </Provider>
    </React.StrictMode>
);
