import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePopper } from 'react-popper';

const Dropdown = (props : any, forwardedRef: any) => {
    const [visibility, setVisibility] = useState<boolean>(false);

    const referenceRef = useRef<any>();
    const popperRef = useRef<any>();

    const { styles, attributes } = usePopper(referenceRef.current, popperRef.current, {
        placement: props.placement || 'bottom-end',
        strategy: 'fixed',
        modifiers: [
            {
                name: 'offset',
                options: {
                    offset: props.offset || [0, 5],
                },
            },
        ],
    });

    const handleDocumentClick = (event: any) => {
        if (referenceRef.current?.contains(event.target) || popperRef.current?.contains(event.target)) {
            return;
        }
        setVisibility(false);
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleDocumentClick);
        return () => {
            document.removeEventListener('mousedown', handleDocumentClick);
        };
    }, []);

    useImperativeHandle(forwardedRef, () => ({
        close() {
            setVisibility(false);
        },
    }));

    return (
        <>
            <button
                ref={referenceRef}
                type="button"
                className={props.btnClassName}
                onClick={() => setVisibility(!visibility)}
            >
                {props.button}
            </button>

            {createPortal(
                <div
                    ref={popperRef}
                    style={{
                        ...styles.popper,
                        zIndex: 9999,
                        display: visibility ? undefined : 'none',
                    }}
                    {...attributes.popper}
                    onClick={() => setVisibility(false)}
                >
                    {props.children}
                </div>,
                document.body
            )}
        </>
    );
};

export default forwardRef(Dropdown);

