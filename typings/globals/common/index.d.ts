interface CommonStatic{
    log(msg: string): void;
}

declare var Common: CommonStatic;

declare module "common" {
    export = Common;
}
