import { useEffect, useRef, useState } from "react";

import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

import Loading from "./loading";

import Error from "./error";


const DEPARTMENT_ROUTES = {
    admin: "/admin/login",
    accounts: "/accounts/login",
    hr: "/hr/login",
    "material-planning": "/material-planning/login",
    production: "/production/login",
    supervisor: "/supervisor/login",
};


const VALID_USER_TYPES = Object.keys(DEPARTMENT_ROUTES);


const DEPARTMENT_PATHS = [
    {
        userType: "material-planning",
        prefixes: ["/inventory", "/material-planning"],
    },
    {
        userType: "admin",
        prefixes: ["/admin"],
    },
    {
        userType: "accounts",
        prefixes: ["/accounts"],
    },
    {
        userType: "hr",
        prefixes: ["/hr"],
    },
    {
        userType: "production",
        prefixes: ["/production"],
    },
    {
        userType: "supervisor",
        prefixes: ["/supervisor"],
    },
];


const SHARED_PATHS = [
    "/welcome",
    "/profile",
];


/*
|--------------------------------------------------------------------------
| Specific route access overrides
|--------------------------------------------------------------------------
|
| Delivery Challan:
| - Accounts
| - Material Planning
| - Admin
|
*/

const ROUTE_ACCESS_OVERRIDES = {
    "/accounts/deliverychallan": [
        "accounts",
        "material-planning",
    ],
};


/*
|--------------------------------------------------------------------------
| Normalize URL paths
|--------------------------------------------------------------------------
*/

function normalizePath(pathname) {
    return (
        String(pathname || "")
            .toLowerCase()
            .replace(/\/+$/, "") || "/"
    );
}


/*
|--------------------------------------------------------------------------
| Identify department from route
|--------------------------------------------------------------------------
*/

function getDepartmentFromPath(pathname) {

    const normalizedPath = normalizePath(pathname);

    for (const department of DEPARTMENT_PATHS) {

        for (const prefix of department.prefixes) {

            const normalizedPrefix = normalizePath(prefix);

            if (
                normalizedPath === normalizedPrefix ||
                normalizedPath.startsWith(`${normalizedPrefix}/`)
            ) {
                return department.userType;
            }
        }
    }

    return null;
}


/*
|--------------------------------------------------------------------------
| Get allowed departments for route
|--------------------------------------------------------------------------
*/

function getAllowedUserTypesFromPath(pathname) {

    const normalizedPath = normalizePath(pathname);

    // Check specific route overrides first.
    if (ROUTE_ACCESS_OVERRIDES[normalizedPath]) {

        return ROUTE_ACCESS_OVERRIDES[normalizedPath];

    }

    const department = getDepartmentFromPath(normalizedPath);

    return department ? [department] : [];
}


/*
|--------------------------------------------------------------------------
| Check shared routes
|--------------------------------------------------------------------------
*/

function isSharedPath(pathname) {

    const normalizedPath = normalizePath(pathname);

    return SHARED_PATHS.some((path) => {

        const normalizedSharedPath = normalizePath(path);

        return (
            normalizedPath === normalizedSharedPath ||
            normalizedPath.startsWith(`${normalizedSharedPath}/`)
        );

    });
}


/*
|--------------------------------------------------------------------------
| Protected Route Component
|--------------------------------------------------------------------------
*/

export default function ProtectedRoute({
    children,
    userType: requestedUserType,
}) {

    const location = useLocation();

    const {
        isAuthenticated,
        user,
        restoreSession,
        authLoading,
        authError,
    } = useAuth();


    const isShared = isSharedPath(location.pathname);


    /*
    |--------------------------------------------------------------------------
    | Determine allowed departments
    |--------------------------------------------------------------------------
    */

    const allowedUserTypes = requestedUserType
        ? [requestedUserType]
        : getAllowedUserTypesFromPath(location.pathname);


    const primaryUserType = allowedUserTypes[0];


    const [checked, setChecked] = useState(false);

    const [checkError, setCheckError] = useState(false);


    // Prevent older async requests from updating newer routes.
    const requestIdRef = useRef(0);


    useEffect(() => {

        const requestId = ++requestIdRef.current;

        let cancelled = false;


        async function checkSession() {

            setChecked(false);

            setCheckError(false);


            const isCurrentRequest = () => (
                !cancelled &&
                requestIdRef.current === requestId
            );


            /*
            |--------------------------------------------------------------------------
            | STEP 1: Already authenticated user
            |--------------------------------------------------------------------------
            |
            | Admin can access every department.
            | Other users must belong to an allowed department.
            |
            */

            if (
                isAuthenticated &&
                user &&
                VALID_USER_TYPES.includes(user.user_type) &&
                (
                    user.user_type === "admin" ||
                    isShared ||
                    allowedUserTypes.includes(user.user_type)
                )
            ) {

                setChecked(true);

                return;
            }


            /*
            |--------------------------------------------------------------------------
            | STEP 2: Shared routes
            |--------------------------------------------------------------------------
            */

            if (isShared) {

                try {

                    for (const department of VALID_USER_TYPES) {

                        if (!isCurrentRequest()) return;

                        const restored = await restoreSession(department);

                        if (!isCurrentRequest()) return;

                        if (restored) {

                            setChecked(true);

                            return;
                        }
                    }

                    setChecked(true);

                } catch (error) {

                    if (!isCurrentRequest()) return;

                    console.error(
                        "Shared route session check failed:",
                        error
                    );

                    setCheckError(true);

                    setChecked(true);
                }

                return;
            }


            /*
            |--------------------------------------------------------------------------
            | STEP 3: Validate protected route
            |--------------------------------------------------------------------------
            */

            if (
                !allowedUserTypes.length ||
                !allowedUserTypes.every((type) =>
                    VALID_USER_TYPES.includes(type)
                )
            ) {

                setChecked(true);

                return;
            }


            /*
            |--------------------------------------------------------------------------
            | STEP 4: Restore department session
            |--------------------------------------------------------------------------
            |
            | First try the requested department.
            | If that fails, try Admin.
            |
            | This allows Admin to access every department
            | using the same Admin refresh cookie.
            |
            */

            const departmentsToTry = [
                ...new Set([
                    ...allowedUserTypes,
                    "admin",
                ]),
            ];


            try {

                for (const department of departmentsToTry) {

                    if (!isCurrentRequest()) return;


                    const restored = await restoreSession(department);


                    if (!isCurrentRequest()) return;


                    if (restored) {

                        setChecked(true);

                        return;
                    }
                }


                setChecked(true);


            } catch (error) {

                if (!isCurrentRequest()) return;

                console.error(
                    "Protected route session check failed:",
                    error
                );

                setCheckError(true);

                setChecked(true);
            }

        }


        checkSession();


        return () => {

            cancelled = true;

        };


    }, [
        location.pathname,
        primaryUserType,
        isShared,
    ]);


    /*
    |--------------------------------------------------------------------------
    | STEP 5: Loading
    |--------------------------------------------------------------------------
    */

    if (authLoading || !checked) {

        return <Loading />;

    }


    /*
    |--------------------------------------------------------------------------
    | STEP 6: Authentication error
    |--------------------------------------------------------------------------
    */

    if (authError || checkError) {

        return <Error />;

    }


    /*
    |--------------------------------------------------------------------------
    | STEP 7: Invalid protected route
    |--------------------------------------------------------------------------
    */

    if (!isShared && !allowedUserTypes.length) {

        return (
            <Navigate
                to="/production/login"
                replace
            />
        );

    }


    /*
    |--------------------------------------------------------------------------
    | STEP 8: User not authenticated
    |--------------------------------------------------------------------------
    */

    if (!isAuthenticated || !user) {

        const loginPath = isShared
            ? "/production/login"
            : DEPARTMENT_ROUTES[primaryUserType];


        return (
            <Navigate
                to={loginPath}
                replace
                state={{ from: location }}
            />
        );

    }


    /*
    |--------------------------------------------------------------------------
    | STEP 9: Validate user type
    |--------------------------------------------------------------------------
    */

    if (!VALID_USER_TYPES.includes(user.user_type)) {

        return (
            <Navigate
                to="/production/login"
                replace
            />
        );

    }


    /*
    |--------------------------------------------------------------------------
    | STEP 10: Shared routes
    |--------------------------------------------------------------------------
    */

    if (isShared) {

        return children;

    }


    /*
    |--------------------------------------------------------------------------
    | STEP 11: Admin has full module access
    |--------------------------------------------------------------------------
    */

    if (user.user_type === "admin") {

        return children;

    }


    /*
    |--------------------------------------------------------------------------
    | STEP 12: Department access validation
    |--------------------------------------------------------------------------
    */

    if (!allowedUserTypes.includes(user.user_type)) {

        return (
            <Navigate
                to={DEPARTMENT_ROUTES[user.user_type]}
                replace
                state={{ from: location }}
            />
        );

    }


    /*
    |--------------------------------------------------------------------------
    | STEP 13: Access granted
    |--------------------------------------------------------------------------
    */

    return children;

}