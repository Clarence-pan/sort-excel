Object.freeze = Object.freeze || function( obj ) {
    var props = Object.getOwnPropertyNames( obj );

    for ( var i = 0; i < props.length; i++ ) {
        var desc = Object.getOwnPropertyDescriptor( obj, props[i] );

        if ( "value" in desc ) {
            desc.writable = false;
        }

        desc.configurable = false;
        Object.defineProperty( obj, props[i], desc );
    }

    return Object.preventExtensions( obj );
};


