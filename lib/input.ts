import readlineSync, { BasicOptions } from "readline-sync";

export const inputSimple = (hint: string) => {
  return readlineSync.question(hint);
};

export const inputConfirm = (hint?: string) => {
  return readlineSync.keyInYNStrict(`${hint || "Confirm?"} `);
};

export const inputPassword = (hint: string) => {
  return readlineSync.question(hint, {
    hideEchoBack: true,
  });
};

export const inputPassword2 = (hint: string) => {
  while (true) {
    const pwd = inputPassword(hint);
    const pwd2 = inputPassword(`(Confirm) ${hint}`);
    if (pwd == pwd2) {
      return pwd;
    }
    console.log("Not Match! Try Again...\n");
  }
};

export const inputCheck = (hint: string, check: (result: string) => boolean) => {
  while (true) {
    const s = readlineSync.question(hint);
    if (check(s)) {
      return s;
    }
  }
};

export const inputInteger = (hint: string) => {
  return readlineSync.questionInt(hint);
};

export const inputSelect = (hint: string, selections: string[], options?: BasicOptions) => {
  return readlineSync.keyInSelect(selections, hint, options);
};
